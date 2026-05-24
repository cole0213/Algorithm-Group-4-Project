import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './screenshots-filter';
mkdirSync(OUT, { recursive: true });

const NL_INPUT = "대학교 졸업생, 경력 3년 이상, 백엔드 채용";

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', (m) => {
  if (m.type() === 'error') log(`console.error: ${m.text()}`);
});
page.on('pageerror', (e) => log(`pageerror: ${e.message}`));

try {
  log('navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // BEFORE 사이드바
  const namesBefore = await page.locator('.applicant-name').allTextContents();
  log(`사이드바 BEFORE (${namesBefore.length}명): [${namesBefore.join(', ')}]`);
  await page.screenshot({ path: join(OUT, '01-before.png'), fullPage: false });

  // 📋 버튼 클릭
  await page.locator('.topbar-field-specs .topbar-input-icon-btn').click();
  await page.waitForSelector('.job-desc-popup', { timeout: 3000 });
  await page.locator('.job-desc-textarea').fill(NL_INPUT);
  await page.screenshot({ path: join(OUT, '02-popup.png'), fullPage: false });

  log('AI 설정 자동 적용 클릭...');
  await page.locator('.job-desc-extract-btn').click();

  // 토스트 + 필터 배너 대기
  const toast = await page.locator('.toast').first()
    .waitFor({ state: 'visible', timeout: 60000 })
    .then(() => page.locator('.toast').first().textContent())
    .catch(() => null);
  log(`토스트: ${toast}`);

  await page.waitForTimeout(1500);

  // AFTER 사이드바
  const namesAfter = await page.locator('.applicant-name').allTextContents();
  log(`사이드바 AFTER  (${namesAfter.length}명): [${namesAfter.join(', ')}]`);

  // 필터 배너 검증
  const bannerVisible = await page.locator('.filter-active-banner').isVisible().catch(() => false);
  let bannerText = null;
  let chips = [];
  if (bannerVisible) {
    bannerText = await page.locator('.filter-active-banner').textContent();
    chips = await page.locator('.filter-active-banner .filter-chip').allTextContents();
  }
  log(`필터 배너 표시: ${bannerVisible}`);
  log(`필터 칩: [${chips.join(' | ')}]`);

  await page.screenshot({ path: join(OUT, '03-after-filter.png'), fullPage: false });

  // 필터 해제 (✕ 클릭) — 검증
  await page.locator('.filter-active-banner .banner-close').click();
  await page.waitForTimeout(500);
  const namesAfterClear = await page.locator('.applicant-name').allTextContents();
  log(`사이드바 필터 해제 후 (${namesAfterClear.length}명): [${namesAfterClear.join(', ')}]`);
  await page.screenshot({ path: join(OUT, '04-filter-cleared.png'), fullPage: false });

  // 검증
  const issues = [];
  if (!bannerVisible) issues.push('필터 배너가 표시되지 않음');
  if (!chips.some(c => c.includes('경력') && c.includes('3'))) issues.push('경력 3년 칩 누락');
  if (!chips.some(c => c.includes('학력'))) issues.push('학력 칩 누락');
  if (namesAfter.length >= namesBefore.length) issues.push(`사이드바가 줄어들지 않음 (${namesBefore.length} -> ${namesAfter.length})`);
  if (namesAfter.includes('심지훈')) issues.push('심지훈(0년)이 필터링되지 않음');
  if (namesAfterClear.length !== namesBefore.length) issues.push(`필터 해제 후 원상복구 실패 (${namesBefore.length} != ${namesAfterClear.length})`);

  const result = {
    namesBefore, namesAfter, namesAfterClear,
    bannerVisible, chips, toast, issues,
    pass: issues.length === 0,
  };
  writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
  log(`\n=== RESULT ===\n${JSON.stringify(result, null, 2)}`);

  if (result.pass) log('\n✅ PASS — 학력·경력·직군 필터 동작 OK');
  else log(`\n❌ FAIL — ${issues.length}개 이슈\n  - ${issues.join('\n  - ')}`);

  process.exitCode = result.pass ? 0 : 1;
} catch (e) {
  log(`테스트 실패: ${e.message}`);
  try { await page.screenshot({ path: join(OUT, 'ERROR.png'), fullPage: false }); } catch {}
  process.exitCode = 2;
} finally {
  await browser.close();
}
