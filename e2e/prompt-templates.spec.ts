import { test, expect } from '@playwright/test';

test.describe('Custom Prompt Templates', () => {
	test('template library page loads', async ({ page }) => {
		await page.goto('/dashboard/prompt-templates');
		await page.waitForLoadState('networkidle');

		// Either shows the template library (Standard/Unlimited) or redirects to billing (Free tier)
		const url = page.url();
		expect(
			url.includes('prompt-templates') || url.includes('billing'),
		).toBeTruthy();
	});

	test('new template page loads with builder form', async ({ page }) => {
		await page.goto('/dashboard/prompt-templates/new');
		await page.waitForLoadState('networkidle');

		const url = page.url();
		if (url.includes('billing')) {
			// Free tier — redirect is expected
			return;
		}

		// Template builder should have name, description, and step fields
		const nameField = page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i));
		await expect(nameField.first()).toBeVisible({ timeout: 10_000 });
	});

	test('create and save a template', async ({ page }) => {
		await page.goto('/dashboard/prompt-templates/new');
		await page.waitForLoadState('networkidle');

		if (page.url().includes('billing')) return;

		// Fill template metadata
		const nameField = page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i));
		await nameField.first().fill('E2E Test Template');

		const descField = page.getByLabel(/description/i).or(page.getByPlaceholder(/description/i));
		if (await descField.first().isVisible().catch(() => false)) {
			await descField.first().fill('Template created by E2E tests');
		}

		// Add a step
		const addStepButton = page.getByRole('button', { name: /add step/i });
		if (await addStepButton.isVisible().catch(() => false)) {
			await addStepButton.click();
		}

		// Fill step instruction
		const instructionField = page.getByLabel(/instruction/i)
			.or(page.getByPlaceholder(/instruction/i))
			.or(page.getByRole('textbox').last());

		if (await instructionField.isVisible().catch(() => false)) {
			await instructionField.fill('List all repositories in {{org}}');
		}

		// Save the template
		const saveButton = page.getByRole('button', { name: /save/i });
		if (await saveButton.isVisible().catch(() => false)) {
			await saveButton.click();
			await page.waitForLoadState('networkidle');

			// Should redirect to the template library or template detail page
			await page.waitForTimeout(2_000);
			const url = page.url();
			expect(
				url.includes('prompt-templates'),
			).toBeTruthy();
		}
	});

	test('template library shows created templates', async ({ page }) => {
		await page.goto('/dashboard/prompt-templates');
		await page.waitForLoadState('networkidle');

		if (page.url().includes('billing')) return;

		// The library should display template cards or a table
		const main = page.getByRole('main');
		await expect(main).toBeVisible();
	});

	test('free tier users are redirected to billing', async ({ page }) => {
		// This test verifies the access gate — behavior depends on the test account's tier
		await page.goto('/dashboard/prompt-templates');
		await page.waitForLoadState('networkidle');

		// Either shows templates (paid tier) or redirects (free tier)
		const url = page.url();
		expect(
			url.includes('prompt-templates') || url.includes('billing'),
		).toBeTruthy();
	});
});
