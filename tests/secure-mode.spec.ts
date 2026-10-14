import { test, expect } from '@playwright/test'
test('unconfigured secure mode fails closed and never substitutes demonstration access', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'For the invited.' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('Secure mode is not configured. The vault remains closed.')
  await expect(page.getByRole('button', { name: 'Explore the demonstration' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Section index' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Documents', exact: true })).toHaveCount(0)
})
