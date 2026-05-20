import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const log = (m) => console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`);

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  await page.waitForTimeout(2500);

  const v0 = await page.locator('input.topbar-input.specs').inputValue();
  log(`requiredSpecs (init): "${v0}"`);

  await page.locator('.topbar-field-specs .topbar-input-icon-btn').click();
  await page.waitForSelector('.job-desc-popup');
  await page.locator('.job-desc-textarea').fill('대학교 졸업생, 경력 3년 이상, 백엔드');
  await page.locator('.job-desc-extract-btn').click();

  await page.locator('.toast').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1500);

  const v1 = await page.locator('input.topbar-input.specs').inputValue();
  log(`requiredSpecs (after non-tech input): "${v1}"`);

  if (v1 === '') log('✅ specs 입력란이 비워짐');
  else log(`❌ specs 입력란이 비워지지 않음 (여전히 "${v1}")`);

  process.exitCode = (v1 === '') ? 0 : 1;
} finally {
  await browser.close();
}
