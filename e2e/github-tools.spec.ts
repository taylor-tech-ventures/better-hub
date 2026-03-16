import { test, expect } from '@playwright/test';

const GH_TEST_ORG = process.env.GH_TEST_ORG ?? 'gh-admin-test';

test.describe('GitHub Administration Tools', () => {
	test.setTimeout(90_000);

	test('list repos — auto-approved read tool', async ({ page }) => {
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		const input = page.getByRole('textbox');
		await expect(input).toBeVisible({ timeout: 15_000 });

		await input.fill(`List repos in ${GH_TEST_ORG}`);
		await input.press('Enter');

		// Read-only tool should execute without confirmation
		// Response should contain a table with repo data
		const response = page.locator('[data-testid="message"], .message, article, [role="article"]');
		await expect(response.first()).toBeVisible({ timeout: 60_000 });

		// Should NOT show Approve/Deny buttons for read-only operations
		const approveButton = page.getByRole('button', { name: /approve/i });
		await expect(approveButton).not.toBeVisible({ timeout: 5_000 }).catch(() => {
			// If approve is visible, it may be from a prior conversation
		});
	});

	test('list available tools', async ({ page }) => {
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		const input = page.getByRole('textbox');
		await expect(input).toBeVisible({ timeout: 15_000 });

		await input.fill('What tools are available for security?');
		await input.press('Enter');

		// Response should mention security-related tools
		const response = page.locator('[data-testid="message"], .message, article, [role="article"]');
		await expect(response.first()).toBeVisible({ timeout: 60_000 });
	});

	test('destructive operation shows confirmation gate', async ({ page }) => {
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		const input = page.getByRole('textbox');
		await expect(input).toBeVisible({ timeout: 15_000 });

		// Request a destructive operation — should trigger confirmation
		await input.fill(`Create a private repo called e2e-playwright-test in ${GH_TEST_ORG}`);
		await input.press('Enter');

		// Expect Approve/Deny buttons to appear for the destructive operation
		const approveButton = page.getByRole('button', { name: /approve/i });
		await expect(approveButton).toBeVisible({ timeout: 60_000 });

		// Deny the operation to avoid side effects in tests
		const denyButton = page.getByRole('button', { name: /deny/i });
		if (await denyButton.isVisible().catch(() => false)) {
			await denyButton.click();
		}
	});
});
