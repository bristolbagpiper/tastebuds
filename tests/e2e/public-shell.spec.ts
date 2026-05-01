import { expect, test } from '@playwright/test'

test('public entry points render without exposing admin surfaces', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Tastebuds').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /admin/i })).toHaveCount(0)
})
