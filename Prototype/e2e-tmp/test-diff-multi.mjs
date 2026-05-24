import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './screenshots-diff';
mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

page.on('console', (m) => { if (m.type() === 'error') log(`console.error: ${m.text()}`); });
page.on('pageerror', (e) => log(`pageerror: ${e.message}`));

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  await page.waitForTimeout(2500);

  const applicantNames = await page.locator('.applicant-name').allTextContents();
  log(`사이드바: ${applicantNames.length}명 — [${applicantNames.join(', ')}]`);
  if (applicantNames.length < 3) {
    log(`❌ 지원자가 ${applicantNames.length}명만 있어 3명 비교 테스트 불가`);
    process.exitCode = 1; process.exit();
  }

  // 3명 선택 — 사이드바 첫 3명 클릭
  for (let i = 0; i < 3; i++) {
    await page.locator('.applicant-item').nth(i).click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(500);
  const openPanels = await page.locator('.portfolio-panel').count();
  log(`열린 패널: ${openPanels}개`);

  // 비교 버튼 확인 — "⇄ 3명 비교"
  const diffBtn = page.locator('.diff-trigger-btn');
  const btnText = await diffBtn.textContent();
  log(`비교 버튼 텍스트: "${btnText}"`);

  await page.screenshot({ path: join(OUT, '01-3-selected.png') });

  // 비교 클릭
  log('비교 버튼 클릭 — Solar API 호출 대기...');
  await diffBtn.click();
  await page.waitForSelector('.diff-modal', { timeout: 5000 });

  // 로딩 → 결과 대기 (최대 60s)
  await page.locator('.diff-modal .diff-table').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(500);

  // 헤더 컬럼 수 확인 — 항목 + 3명
  const headerCols = await page.locator('.diff-table thead th').count();
  log(`헤더 컬럼 수: ${headerCols} (4여야 함: 항목 + 3명)`);

  // 각 헤더 이름 출력
  const headerTexts = await page.locator('.diff-table thead th').allTextContents();
  log(`헤더 라벨: [${headerTexts.join(' | ')}]`);

  // 행 (각 비교 항목)
  const rowCount = await page.locator('.diff-table tbody tr').count();
  log(`항목 행 수: ${rowCount}`);

  // 첫 행 셀 확인 — 항목 라벨 + 3개 값
  const firstRowCells = await page.locator('.diff-table tbody tr').first().locator('td').count();
  log(`첫 행 셀 수: ${firstRowCells} (4여야 함)`);

  // Solar/Local 뱃지
  const badgeText = await page.locator('.diff-modal').locator('span').filter({ hasText: /Solar|로컬/ }).first().textContent().catch(() => null);
  log(`분석 모드: ${badgeText}`);

  await page.screenshot({ path: join(OUT, '02-diff-modal.png') });

  // 검증
  const issues = [];
  if (!btnText?.includes('3명')) issues.push(`비교 버튼에 "3명" 표시 없음 — "${btnText}"`);
  if (headerCols !== 4) issues.push(`헤더 컬럼 ${headerCols} ≠ 4`);
  if (firstRowCells !== 4) issues.push(`행 셀 수 ${firstRowCells} ≠ 4`);
  if (rowCount < 4) issues.push(`비교 항목 ${rowCount}개 < 4 (경력/학력/기술스택 최소)`);
  if (!badgeText) issues.push('분석 모드 뱃지(Solar/로컬) 표시 없음');

  const pass = issues.length === 0;
  log(`\n=== ${pass ? '✅ PASS' : '❌ FAIL'} ===`);
  if (!pass) issues.forEach(i => log(`  - ${i}`));

  process.exitCode = pass ? 0 : 1;
} catch (e) {
  log(`테스트 실패: ${e.message}`);
  try { await page.screenshot({ path: join(OUT, 'ERROR.png') }); } catch {}
  process.exitCode = 2;
} finally {
  await browser.close();
}
