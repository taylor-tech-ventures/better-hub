# gh-admin CLI

Command-line interface for gh-admin.com — manage GitHub organizations with AI assistance from your terminal.

## Installation

### Standalone binary (recommended)

Download the latest binary for your platform from [GitHub Releases](https://github.com/taylor-tech-ventures/gh-admin.com/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/taylor-tech-ventures/gh-admin.com/releases/latest/download/gh-admin-darwin-arm64 -o gh-admin
chmod +x gh-admin
sudo mv gh-admin /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/taylor-tech-ventures/gh-admin.com/releases/latest/download/gh-admin-darwin-x64 -o gh-admin
chmod +x gh-admin
sudo mv gh-admin /usr/local/bin/

# Linux (x64)
curl -L https://github.com/taylor-tech-ventures/gh-admin.com/releases/latest/download/gh-admin-linux-x64 -o gh-admin
chmod +x gh-admin
sudo mv gh-admin /usr/local/bin/

# Linux (ARM64)
curl -L https://github.com/taylor-tech-ventures/gh-admin.com/releases/latest/download/gh-admin-linux-arm64 -o gh-admin
chmod +x gh-admin
sudo mv gh-admin /usr/local/bin/
```

### npm

```bash
npm install -g @gh-admin/cli
```

## Authentication

The CLI uses GitHub's OAuth Device Flow — no secrets or tokens to manage manually.

```bash
# Sign in
gh-admin auth login

# Check status
gh-admin auth status

# Sign out
gh-admin auth logout
```

### How it works

1. `gh-admin auth login` initiates the device flow and displays a one-time code
2. Your browser opens to `https://github.com/login/device`
3. Enter the code and authorize the app
4. The CLI polls until authorization completes, then stores the session locally

Sessions expire after 8 hours (same as the web app). Use `--no-browser` to skip automatic browser opening.

## Commands

### AI Chat

The primary interface — an interactive AI chat session for GitHub administration.

```bash
# Interactive mode (full-screen TUI)
gh-admin chat

# Single-shot mode
gh-admin chat --prompt "list all repos in my-org"
gh-admin chat -p "add team backend-devs to repo my-org/api with write access"

# Auto-approve destructive operations (for scripting)
gh-admin chat --yes
```

The chat uses the same 34-tool AI agent as the web app. Destructive operations (delete repos, remove users, etc.) require explicit approval unless `--yes` is passed.

### Organization Commands

```bash
# List your organizations
gh-admin org list

# List repos in an org
gh-admin org repos my-org

# List teams in an org
gh-admin org teams my-org
```

### Billing Commands

```bash
# Show current plan and usage
gh-admin billing status

# Show detailed usage statistics
gh-admin billing usage

# Open billing portal in browser
gh-admin billing upgrade
```

### Configuration

```bash
# Set API URL (for self-hosted or development)
gh-admin config set apiUrl https://my-instance.example.com

# Get a config value
gh-admin config get apiUrl

# List all configuration
gh-admin config list
```

## Configuration

Configuration is stored in `~/.config/gh-admin/config.json` (or the XDG equivalent on your platform).

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GH_ADMIN_API_URL` | Override the API URL | `https://gh-admin.com` |

## Scripting

The CLI supports non-interactive use for automation:

```bash
# Single-shot chat with auto-approve
gh-admin chat -p "create repo my-org/new-service --private" --yes

# Pipe output
gh-admin org repos my-org 2>/dev/null

# Check auth status in scripts
gh-admin auth status >/dev/null 2>&1 || gh-admin auth login
```

## Architecture

The CLI is a **thin client** that connects to the same Cloudflare Workers backend as the web app:

- **AI Chat**: WebSocket connection to `/agents/GitHubAgent/{userId}` (same as the web client)
- **Direct commands**: HTTP requests to oRPC endpoints (same API as the web client)
- **Authentication**: GitHub OAuth Device Flow, creating the same Better Auth sessions
- **Billing/Usage**: All tracking happens server-side — CLI and web share the same quotas

### CLI-specific server behavior

When the CLI connects via WebSocket, it includes `?client=cli` in the connection URL. The server detects this and:

1. Uses a CLI-specific system prompt that instructs the AI to output markdown tables instead of json-render specs
2. Skips the json-render stream transformation, sending plain text

### Build & Distribution

- TypeScript compiled with `tsc`
- Bundled with `@vercel/ncc` into a single file
- Packaged as standalone binaries using Node.js Single Executable Applications (SEA)
- Published to npm and GitHub Releases via the `cli-release.yml` workflow
