import { test, expect } from '@playwright/test'
test('presentation opens without Auth but all confidential features remain closed', async ({ page }) => {
 let protectedReads = 0
 page.on('request', request => { if (/\/rest\/v1\/|\/api\/vault\//.test(request.url())) protectedReads++ })
 await page.goto('/')
 await page.getByRole('button', { name: 'Skip intro', exact: true }).click()
 await page.getByLabel('Presentation PIN').fill('2323')
 await page.getByRole('button', { name: 'Enter', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'Conviction, made tangible.' })).toBeVisible()
 await expect(page.getByRole('navigation', { name: 'Section index' }).locator('li')).toHaveCount(11)
 await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0)
 await expect(page.getByText('Demonstration edition')).toHaveCount(0)
 for (const title of ['Introduction','Current Position','History & Evidence','Assets & Claims','Financial Requirements','Beobacht Alignment','Commercial Pipeline','Southern African Strategy','Financial Forecast','Investment Structures','Closing']) {
  await page.getByRole('button', { name: 'Open ' + title, exact: true }).click()
  await expect(page.getByRole('status')).toContainText('access pending.')
  await expect(page.getByLabel('Starting monthly revenue')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to Console', exact: true }).click()
 }
 await page.getByRole('button', { name: 'Documents', exact: true }).click()
 await expect(page.getByText('Document access pending.').first()).toBeVisible()
 await page.getByRole('button', { name: 'Back to Console', exact: true }).click()
 await page.getByRole('button', { name: 'Portfolio', exact: true }).click()
 await expect(page.getByRole('tab', { name: /Showcase/ })).toBeVisible()
 await expect(page.getByText('Document access pending.')).toBeVisible()
 await page.getByRole('tab', { name: /Client Engagements/ }).click()
 await expect(page.getByText('Document access pending.')).toBeVisible()
 expect(protectedReads).toBe(0)
})
