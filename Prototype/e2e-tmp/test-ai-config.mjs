import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './screenshots';
mkdirSync(OUT, { recursive: true });

const NL_INPUT = `백엔드 개발자 채용
필수: Python, FastAPI, PostgreSQL
우대: AWS, Kubernetes, gRPC

포트폴리오는 경력·기술·프로젝트 위주로 보고 싶음.
자기소개나 수상 내역은 빼줘. 프로젝트 비중을 더 크게 보고 싶어.`;

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
  // 초기 분석 결과 로딩 대기
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  await page.waitForTimeout(2500); // initial analyze 대기
  await page.screenshot({ path: join(OUT, '01-initial.png'), fullPage: false });
  log('saved 01-initial.png');

  // 사이드바 첫 지원자 클릭해서 패널 열기 (섹션 가시화 검증용)
  const firstApplicant = page.locator('.applicant-item').first();
  await firstApplicant.click();
  await page.waitForSelector('.portfolio-panel', { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '02-panel-before.png'), fullPage: false });
  log('saved 02-panel-before.png — 모든 섹션 표시 상태');

  // 변경 전 섹션 헤더 라벨 수집
  const sectionsBefore = await page.locator('.portfolio-panel .section-header .md-h2').allTextContents();
  log(`섹션 BEFORE: [${sectionsBefore.join(', ')}]`);

  // 필요 스펙 입력 BEFORE
  const specsBefore = await page.locator('input.topbar-input.specs').inputValue();
  log(`필요 스펙 BEFORE: "${specsBefore}"`);

  // 📋 버튼 클릭 (필요 스펙 우측 인라인 버튼)
  const specsField = page.locator('.topbar-field-specs');
  await specsField.locator('.topbar-input-icon-btn').click();
  await page.waitForSelector('.job-desc-popup', { timeout: 3000 });
  await page.screenshot({ path: join(OUT, '03-popup-open.png'), fullPage: false });
  log('saved 03-popup-open.png');

  // 자연어 입력
  await page.locator('.job-desc-textarea').fill(NL_INPUT);
  await page.screenshot({ path: join(OUT, '04-popup-filled.png'), fullPage: false });
  log('saved 04-popup-filled.png');

  // 추출 버튼 클릭
  log('AI 설정 자동 적용 버튼 클릭...');
  await page.locator('.job-desc-extract-btn').click();

  // 토스트 표시 대기 (성공/실패)
  const toast = await page
    .locator('.toast')
    .first()
    .waitFor({ state: 'visible', timeout: 60000 })
    .then(() => page.locator('.toast').first().textContent())
    .catch(() => null);
  log(`토스트: ${toast}`);

  await page.waitForTimeout(1500);

  // 필요 스펙 입력 AFTER
  const specsAfter = await page.locator('input.topbar-input.specs').inputValue();
  log(`필요 스펙 AFTER:  "${specsAfter}"`);

  // 변경 후 섹션 헤더
  const sectionsAfter = await page.locator('.portfolio-panel .section-header .md-h2').allTextContents();
  log(`섹션 AFTER:  [${sectionsAfter.join(', ')}]`);

  await page.screenshot({ path: join(OUT, '05-after-apply.png'), fullPage: false });
  log('saved 05-after-apply.png');

  // 검증
  const issues = [];
  if (specsAfter === specsBefore) issues.push('필요 스펙이 변경되지 않음');
  if (!/Python|FastAPI/.test(specsAfter)) issues.push('Python/FastAPI가 스펙에 없음');
  if (sectionsAfter.includes('자기소개')) issues.push('자기소개 섹션이 여전히 표시됨');
  if (sectionsAfter.includes('수상 및 활동')) issues.push('수상 섹션이 여전히 표시됨');
  if (!sectionsAfter.includes('프로젝트')) issues.push('프로젝트 섹션이 사라짐');

  // 결과 요약 JSON 저장
  const result = {
    specsBefore, specsAfter,
    sectionsBefore, sectionsAfter,
    toast,
    issues,
    pass: issues.length === 0,
  };
  writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
  log(`\n=== RESULT ===\n${JSON.stringify(result, null, 2)}`);

  if (result.pass) log('\n✅ PASS — AI 설정 자동 적용 동작 OK');
  else log(`\n❌ FAIL — ${issues.length}개 이슈\n  - ${issues.join('\n  - ')}`);

  process.exitCode = result.pass ? 0 : 1;
} catch (e) {
  log(`테스트 실패: ${e.message}`);
  try { await page.screenshot({ path: join(OUT, 'ERROR.png'), fullPage: false }); } catch {}
  process.exitCode = 2;
} finally {
  await browser.close();
}
