#!/usr/bin/env node
// Generates a TOTP code from GH_TEST_MFA_SECRET environment variable.
// Usage: node .claude/hooks/generate-totp.mjs
// Output: 6-digit TOTP code to stdout

import { TOTP } from "otpauth";

const secret = process.env.GH_TEST_MFA_SECRET;
if (!secret) {
	process.stderr.write("ERROR: GH_TEST_MFA_SECRET environment variable is not set\n");
	process.exit(1);
}

const totp = new TOTP({
	secret,
	digits: 6,
	period: 30,
	algorithm: "SHA1",
});

process.stdout.write(totp.generate());
