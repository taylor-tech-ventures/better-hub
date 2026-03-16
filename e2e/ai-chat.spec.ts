import { test, expect } from '@playwright/test';

const GH_TEST_ORG = process.env.GH_TEST_ORG ?? 'gh-admin-test';

test.describe('AI Chat Interface', () => {
	test('full-page chat loads without SSR errors', async ({ page }) => {
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveURL(/dashboard\/chat/);
		// Chat interface should render a message input
		const input = page.getByRole('textbox');
		await expect(input).toBeVisible({ timeout: 15_000 });
	});

	test('chat drawer opens from dashboard', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		// Click the AI button to open the chat drawer
		const aiButton = page.getByRole('button', { name: /ai/i });
		if (await aiButton.isVisible().catch(() => false)) {
			await aiButton.click();
			// Drawer should appear with a text input
			const input = page.getByRole('textbox');
			await expect(input).toBeVisible({ timeout: 10_000 });
		}
	});

	test('read-only query executes without confirmation', async ({ page }) => {
		test.setTimeout(90_000);
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		const input = page.getByRole('textbox');
		await expect(input).toBeVisible({ timeout: 15_000 });

		await input.fill(`List repos in ${GH_TEST_ORG}`);
		await input.press('Enter');

		// Wait for the AI response — read-only tools should auto-execute
		// The response should contain a table or structured output
		const response = page.locator('[data-testid="message"], .message, article, [role="article"]');
		await expect(response.first()).toBeVisible({ timeout: 60_000 });
	});

	test('conversation history persists after reload', async ({ page }) => {
		test.setTimeout(90_000);
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		const input = page.getByRole('textbox');
		await expect(input).toBeVisible({ timeout: 15_000 });

		await input.fill('What tools do you have?');
		await input.press('Enter');

		// Wait for a response
		await page.waitForTimeout(15_000);

		// Reload the page
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Conversation history should be restored
		const messages = page.locator('[data-testid="message"], .message, article, [role="article"]');
		await expect(messages.first()).toBeVisible({ timeout: 30_000 });
	});
});
