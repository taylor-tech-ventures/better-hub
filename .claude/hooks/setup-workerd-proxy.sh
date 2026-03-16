#!/usr/bin/env bash
# Sets up a transparent proxy (redsocks) so that workerd (Cloudflare's local
# runtime) can reach external HTTPS hosts in cloud environments where direct
# outbound traffic is blocked and only an authenticated HTTP CONNECT proxy is
# available.
#
# Background: workerd is a C++ binary that does NOT honor HTTPS_PROXY. In Claude
# Code cloud sessions, a firewall blocks all direct outbound traffic on ports 53
# and 443. The only route out is via an authenticated MITM proxy. This script
# uses redsocks + iptables to transparently redirect workerd's HTTPS connections
# through that proxy.
#
# Called by setup-cloud-session.sh during SessionStart.
# Idempotent — safe to run multiple times.

set -euo pipefail

# ─── Guard: only run in cloud sessions with a proxy ───────────────────────────
[ -z "${HTTPS_PROXY:-}" ] && exit 0

REDSOCKS_PORT=12345
REDSOCKS_CONF="/tmp/redsocks.conf"
REDSOCKS_LOG="/tmp/redsocks.log"

# Hosts that workerd needs to reach (GitHub OAuth, OpenAI API, Stripe billing)
EXTERNAL_HOSTS=(
    github.com
    api.github.com
    api.openai.com
    api.stripe.com
)

# ─── Skip if already running ─────────────────────────────────────────────────
if pgrep -f "redsocks -c $REDSOCKS_CONF" >/dev/null 2>&1; then
    echo "==> redsocks already running, skipping setup"
    exit 0
fi

# ─── 1. Install redsocks if missing ──────────────────────────────────────────
if ! command -v redsocks >/dev/null 2>&1; then
    echo "==> Installing redsocks..."
    apt-get update -qq && apt-get install -y -qq redsocks >/dev/null 2>&1
fi

# ─── 2. Parse proxy URL ──────────────────────────────────────────────────────
# HTTPS_PROXY format: http://username:password@host:port
PROXY_PARTS=$(python3 -c "
import os, urllib.parse
p = urllib.parse.urlparse(os.environ['HTTPS_PROXY'])
print(f'{p.hostname}\n{p.port}\n{p.username or \"\"}\n{urllib.parse.unquote(p.password or \"\")}')")

PROXY_HOST=$(echo "$PROXY_PARTS" | sed -n '1p')
PROXY_PORT=$(echo "$PROXY_PARTS" | sed -n '2p')
PROXY_USER=$(echo "$PROXY_PARTS" | sed -n '3p')
PROXY_PASS=$(echo "$PROXY_PARTS" | sed -n '4p')

if [ -z "$PROXY_HOST" ] || [ -z "$PROXY_PORT" ]; then
    echo "ERROR: Could not parse HTTPS_PROXY URL" >&2
    exit 1
fi

# ─── 3. Resolve external host IPs via DNS-over-HTTPS ─────────────────────────
# Direct DNS (port 53) is blocked; use Cloudflare DoH through the proxy.
declare -A HOST_IPS
echo "==> Resolving external host IPs via DNS-over-HTTPS..."

for host in "${EXTERNAL_HOSTS[@]}"; do
    ips=$(curl -s --proxy "$HTTPS_PROXY" \
        "https://cloudflare-dns.com/dns-query?name=${host}&type=A" \
        -H "accept: application/dns-json" 2>/dev/null \
        | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for answer in data.get('Answer', []):
        if answer.get('type') == 1:
            print(answer['data'])
except: pass" 2>/dev/null)

    if [ -n "$ips" ]; then
        HOST_IPS["$host"]="$ips"
        echo "    $host -> $(echo $ips | tr '\n' ' ')"
    else
        echo "    WARNING: Could not resolve $host" >&2
    fi
done

# ─── 4. Add /etc/hosts entries ────────────────────────────────────────────────
# workerd can't do DNS lookups (port 53 blocked), so we pin IPs in /etc/hosts.
echo "==> Updating /etc/hosts..."
for host in "${EXTERNAL_HOSTS[@]}"; do
    ips="${HOST_IPS[$host]:-}"
    [ -z "$ips" ] && continue
    # Use the first IP
    ip=$(echo "$ips" | head -1)
    # Remove any existing entry for this host, then add the new one
    sed -i "/[[:space:]]${host}$/d" /etc/hosts
    echo "$ip $host" >> /etc/hosts
done

# ─── 5. Create redsocks config ───────────────────────────────────────────────
cat > "$REDSOCKS_CONF" <<CONF
base {
    log_debug = off;
    log_info = on;
    log = "file:$REDSOCKS_LOG";
    daemon = on;
    redirector = iptables;
}

redsocks {
    local_ip = 127.0.0.1;
    local_port = $REDSOCKS_PORT;
    ip = $PROXY_HOST;
    port = $PROXY_PORT;
    type = http-connect;
    login = "$PROXY_USER";
    password = "$PROXY_PASS";
}
CONF

# ─── 6. Start redsocks ───────────────────────────────────────────────────────
echo "==> Starting redsocks daemon..."
redsocks -c "$REDSOCKS_CONF"
sleep 1

if ! pgrep -f "redsocks -c $REDSOCKS_CONF" >/dev/null 2>&1; then
    echo "ERROR: redsocks failed to start. Check $REDSOCKS_LOG" >&2
    cat "$REDSOCKS_LOG" >&2
    exit 1
fi

# ─── 7. Set up iptables NAT rules ────────────────────────────────────────────
# Create a REDSOCKS chain that redirects port 443 traffic for known external
# IPs through the redsocks transparent proxy. Skip local/private ranges and
# the proxy host itself to avoid loops.
echo "==> Configuring iptables..."

# Clean up any existing REDSOCKS chain
iptables -t nat -D OUTPUT -p tcp --dport 443 -j REDSOCKS 2>/dev/null || true
iptables -t nat -F REDSOCKS 2>/dev/null || true
iptables -t nat -X REDSOCKS 2>/dev/null || true

# Create fresh chain
iptables -t nat -N REDSOCKS

# Skip local/private ranges
iptables -t nat -A REDSOCKS -d 127.0.0.0/8 -j RETURN
iptables -t nat -A REDSOCKS -d 10.0.0.0/8 -j RETURN
iptables -t nat -A REDSOCKS -d 172.16.0.0/12 -j RETURN
iptables -t nat -A REDSOCKS -d 192.168.0.0/16 -j RETURN
# Skip the proxy host itself (avoid redirect loops)
iptables -t nat -A REDSOCKS -d "$PROXY_HOST" -j RETURN

# Redirect known external host IPs through redsocks
for host in "${EXTERNAL_HOSTS[@]}"; do
    ips="${HOST_IPS[$host]:-}"
    [ -z "$ips" ] && continue
    while IFS= read -r ip; do
        [ -n "$ip" ] && iptables -t nat -A REDSOCKS -p tcp -d "$ip" --dport 443 -j REDIRECT --to-ports "$REDSOCKS_PORT"
    done <<< "$ips"
done

# Attach the chain to OUTPUT
iptables -t nat -A OUTPUT -p tcp --dport 443 -j REDSOCKS

echo "==> Workerd transparent proxy setup complete"
