import { test, expect } from '@playwright/test'

test('entry, complete index, rotary keyboard control and reading navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Private by intention/ })).toBeVisible()
  await page.getByRole('button', { name: 'Explore the demonstration' }).click()
  await expect(page.getByRole('heading', { name: 'Conviction, made tangible.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Section index' }).locator('li')).toHaveCount(11)
  const context = page.getByRole('slider', { name: 'Context section' })
  await context.focus()
  await context.press('End')
  await expect(context).toHaveAttribute('aria-valuenow', '4')
  await page.getByRole('button', { name: 'Open section', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Substance, with provenance.' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Console' }).click()
  const future = page.getByRole('slider', { name: 'Future section' })
  await future.focus()
  await future.press('End')
  await expect(future).toHaveAttribute('aria-valuenow', '11')
  await future.press('Home')
  await expect(future).toHaveAttribute('aria-valuenow', '5')
  await future.press('ArrowRight')
  await expect(future).toHaveAttribute('aria-valuenow', '6')
  await page.getByRole('button', { name: 'Open Introduction', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'A considered beginning.' })).toBeVisible()
  await expect(page.locator('h1')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('direct reading of every section and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demonstration' }).click()
  for (const title of ['Introduction','Current Position','History & Evidence','Assets & Claims','Financial Requirements','Beobacht Alignment','Commercial Pipeline','Southern African Strategy','Financial Forecast','Investment Structures','Closing']) {
    await page.getByRole('button', { name: 'Open ' + title, exact: true }).click()
    await expect(page.locator('.reader-number')).toContainText(title)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Back to Console' }).click()
  }
})
