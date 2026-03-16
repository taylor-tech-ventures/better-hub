import { test as setup, expect } from '@playwright/test';

/**
 * Global setup: authenticates via GitHub OAuth and saves browser state.
 *
 * Required environment variables:
 *   GH_TEST_USERNAME — GitHub username for the test account
 *   GH_TEST_PASSWORD — GitHub password for the test account
 *   GH_TEST_MFA_SECRET — (optional) TOTP base32 secret for 2FA accounts
 */
setup('authenticate via GitHub OAuth', async ({ page }) => {
	const username = process.env.GH_TEST_USERNAME;
	const password = process.env.GH_TEST_PASSWORD;

	if (!username || !password) {
		throw new Error(
			'GH_TEST_USERNAME and GH_TEST_PASSWORD environment variables are required for E2E tests',
		);
	}

	// Navigate to login page
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	// Click "Sign in with GitHub"
	await page.getByRole('button', { name: /sign in with github/i }).click();
	await page.waitForLoadState('networkidle');

	// Fill GitHub credentials if on the login page
	if (page.url().includes('github.com/login')) {
		await page.fill('#login_field', username);
		await page.fill('#password', password);
		await page.click('[name=commit]');
		await page.waitForLoadState('networkidle');
	}

	// Handle 2FA if prompted
	if (page.url().includes('github.com/sessions/two-factor')) {
		const mfaSecret = process.env.GH_TEST_MFA_SECRET;
		if (!mfaSecret) {
			throw new Error(
				'GitHub 2FA is required but GH_TEST_MFA_SECRET is not set',
			);
		}

		// Navigate to TOTP form if on WebAuthn page
		if (page.url().includes('webauthn')) {
			await page.goto('https://github.com/sessions/two-factor/app');
			await page.waitForLoadState('networkidle');
		}

		const { TOTP } = await import('otpauth');
		const totp = new TOTP({ secret: mfaSecret, digits: 6, period: 30, algorithm: 'SHA1' });
		const code = totp.generate();

		await page.fill('#app_totp', code).catch(() =>
			page.getByRole('textbox').fill(code),
		);
		await page.waitForLoadState('networkidle');
	}

	// Handle OAuth authorization page
	if (page.url().includes('github.com/login/oauth')) {
		const authorizeButton = page.getByRole('button', { name: /authorize/i });
		if (await authorizeButton.isVisible().catch(() => false)) {
			await authorizeButton.click();
			await page.waitForLoadState('networkidle');
		}
	}

	// Wait for redirect back to the app dashboard
	await page.waitForURL('**/dashboard/**', { timeout: 30_000 });
	await expect(page).toHaveURL(/dashboard/);

	// Save authenticated state
	await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
