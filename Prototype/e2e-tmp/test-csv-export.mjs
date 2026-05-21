import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './screenshots-csv';
mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();

page.on('console', (m) => {
  if (m.type() === 'error') log(`console.error: ${m.text()}`);
});
page.on('pageerror', (e) => log(`pageerror: ${e.message}`));

// confirm 다이얼로그 자동 수락 (취소 시나리오 검증을 위해 별도 모드)
const MODE = process.env.MODE || 'accept'; // accept | dismiss
page.on('dialog', async (d) => {
  log(`다이얼로그 [${d.type()}]: ${d.message().split('\n')[0]}`);
  if (MODE === 'dismiss') await d.dismiss();
  else await d.accept();
});

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // 사이드바 지원자 수 확인
  const applicantCount = await page.locator('.applicant-name').count();
  log(`사이드바 지원자: ${applicantCount}명`);
  await page.screenshot({ path: join(OUT, '01-ready.png') });

  // ⊞ 버튼 위치/title 확인 (스킬 매트릭스 CSV 내보내기)
  const btn = page.locator('.topbar-icon-btn[title*="CSV"]');
  const btnTitle = await btn.getAttribute('title');
  log(`⊞ 버튼 title: "${btnTitle}"`);

  // 모달이 더이상 뜨지 않는지 검증을 위해 click 전후 .matrix-modal 부재 확인
  const matrixModalExistsBefore = await page.locator('.matrix-modal').count();
  log(`(sanity) .matrix-modal 노드 개수: ${matrixModalExistsBefore} (0이어야 함)`);

  // 다운로드 트리거
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    btn.click(),
  ]);
  const filename = download.suggestedFilename();
  log(`다운로드 파일명: ${filename}`);

  // 저장 + 내용 확인
  const savePath = join(OUT, filename);
  await download.saveAs(savePath);
  const raw = readFileSync(savePath, 'utf-8');
  const hasBom = raw.charCodeAt(0) === 0xFEFF;
  const text = hasBom ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headerCols = lines[0]?.split(',') || [];
  log(`UTF-8 BOM: ${hasBom}`);
  log(`총 줄 수: ${lines.length} (헤더 + ${lines.length - 1}명)`);
  log(`헤더 열 수: ${headerCols.length} → 처음 5개 [${headerCols.slice(0, 5).join(', ')}]`);
  log(`샘플 데이터: ${lines[1]?.slice(0, 200)}...`);

  // 다운로드 후 모달이 뜨지 않았는지 확인
  await page.waitForTimeout(800);
  const matrixModalAfter = await page.locator('.matrix-modal').count();
  log(`다운로드 후 .matrix-modal 개수: ${matrixModalAfter} (0이어야 함)`);
  await page.screenshot({ path: join(OUT, '02-after-click.png') });

  // 토스트 확인
  const toast = await page.locator('.toast').first().textContent().catch(() => null);
  log(`토스트: ${toast}`);

  // 검증
  const issues = [];
  if (!filename.endsWith('.csv')) issues.push(`파일명이 .csv가 아님: ${filename}`);
  if (!hasBom) issues.push('UTF-8 BOM 없음 (Excel에서 한글 깨질 수 있음)');
  if (headerCols.length < 4) issues.push(`헤더가 너무 짧음: ${headerCols.length}개`);
  if (lines.length - 1 !== applicantCount) issues.push(`데이터 행 수 불일치: ${lines.length - 1} vs ${applicantCount}`);
  if (matrixModalAfter > 0) issues.push('스킬 매트릭스 모달이 뜸 (제거되지 않음)');
  if (!headerCols.includes('지원자')) issues.push('"지원자" 컬럼 누락');
  if (!toast || !toast.includes('CSV')) issues.push('성공 토스트 없음');

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
