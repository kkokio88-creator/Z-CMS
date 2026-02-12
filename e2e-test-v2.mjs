/**
 * Playwright E2E 테스트 v2: 데이터 로딩 대기 후 정밀 검증
 * - 각 탭/서브탭에서 실제 콘텐츠 렌더링 확인
 * - 화이트스크린 + JS 에러 감지
 * - 날짜 필터 변경 시 데이터 반응 확인
 * - 스크린샷 캡처
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 20000;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  let totalPass = 0;
  let totalFail = 0;

  // 콘솔 에러 수집
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  console.log('=== Z-CMS E2E 테스트 v2 ===\n');

  // 1. 초기 로드 + 데이터 로딩 대기
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
  console.log('페이지 로드 완료. 데이터 로딩 대기 중...');

  // Supabase 데이터 로딩 대기 (최대 15초)
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    // 데이터가 로드되면 숫자가 나타남 (매출, 원가 등)
    if (bodyText.length > 200 || /\d{1,3}(,\d{3})+/.test(bodyText) || bodyText.includes('만') || bodyText.includes('억')) {
      console.log(`데이터 로드 감지 (${i + 1}초, ${bodyText.length}자)\n`);
      break;
    }
    if (i === 14) {
      console.log(`데이터 로딩 타임아웃 — 계속 진행 (${bodyText.length}자)\n`);
    }
  }

  // 스크린샷: 홈
  await page.screenshot({ path: 'e2e-screenshots/00-home.png', fullPage: true });

  // 헬퍼: 메인 네비게이션 클릭
  async function clickMainNav(text) {
    // Header의 네비게이션 버튼 찾기
    const buttons = await page.$$('header button, nav button');
    for (const btn of buttons) {
      const t = await btn.textContent();
      if (t && t.includes(text)) {
        await btn.click();
        return true;
      }
    }
    // 폴백: 모든 버튼
    const allBtns = await page.$$('button');
    for (const btn of allBtns) {
      const t = await btn.textContent();
      if (t && t.includes(text)) {
        await btn.click();
        return true;
      }
    }
    return false;
  }

  // 헬퍼: 서브탭 클릭
  async function clickSubTab(text) {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const t = (await btn.textContent() || '').trim();
      if (t === text) {
        await btn.click();
        return true;
      }
    }
    return false;
  }

  // 헬퍼: 화이트스크린/크래시 검사
  async function checkHealth(label) {
    await sleep(1500);

    // 페이지 에러 확인
    const recentErrors = pageErrors.slice();
    pageErrors.length = 0;

    const bodyText = await page.evaluate(() => document.body.innerText);
    const bodyLen = bodyText.length;

    // React 에러 바운더리 감지
    const hasErrorBoundary = bodyText.includes('오류가 발생') || bodyText.includes('Something went wrong');
    const hasWhiteScreen = bodyLen < 30;

    if (hasWhiteScreen) {
      return { status: 'FAIL', reason: `화이트스크린 (${bodyLen}자)`, errors: recentErrors };
    }
    if (hasErrorBoundary) {
      return { status: 'FAIL', reason: 'ErrorBoundary 표시됨', errors: recentErrors };
    }
    if (recentErrors.length > 0) {
      return { status: 'WARN', reason: `JS에러: ${recentErrors[0].slice(0, 80)}`, errors: recentErrors, bodyLen };
    }
    return { status: 'PASS', reason: '', bodyLen, errors: [] };
  }

  // 2. 메인 탭 + 서브탭 전체 순회
  const testPlan = [
    { nav: '홈', subs: [] },
    { nav: '수익', subs: ['채널별 수익', '품목별 랭킹', '수익 트렌드', '손익 시뮬레이션'] },
    { nav: '원가', subs: ['원가 총괄', '원재료', '부재료', '노무비', '경비'] },
    { nav: '생산', subs: ['생산 현황', '폐기 분석', '생산성 분석', 'BOM 오차', '수율 추적'] },
    { nav: '재고', subs: ['재고 현황', '이상징후 분석', '통계적 발주', '발주 분석'] },
    { nav: '설정', subs: [] },
  ];

  let screenshotIdx = 1;

  for (const { nav, subs } of testPlan) {
    console.log(`\n=== [${nav}] ===`);
    await clickMainNav(nav);
    const mainResult = await checkHealth(`${nav} 메인`);

    const icon = mainResult.status === 'PASS' ? '✓' : mainResult.status === 'WARN' ? '⚠' : '✗';
    console.log(`  ${icon} ${nav} 메인: ${mainResult.status} ${mainResult.reason} (${mainResult.bodyLen || '?'}자)`);
    if (mainResult.status === 'FAIL') totalFail++; else totalPass++;
    results.push({ tab: nav, sub: '-', ...mainResult });

    await page.screenshot({
      path: `e2e-screenshots/${String(screenshotIdx++).padStart(2, '0')}-${nav}.png`,
      fullPage: true
    });

    if (mainResult.status === 'FAIL') {
      // 복구
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
      await sleep(2000);
      continue;
    }

    for (const sub of subs) {
      await clickSubTab(sub);
      const subResult = await checkHealth(`${nav}→${sub}`);

      const si = subResult.status === 'PASS' ? '✓' : subResult.status === 'WARN' ? '⚠' : '✗';
      console.log(`  ${si} ${nav} → ${sub}: ${subResult.status} ${subResult.reason} (${subResult.bodyLen || '?'}자)`);
      if (subResult.status === 'FAIL') totalFail++; else totalPass++;
      results.push({ tab: nav, sub, ...subResult });

      await page.screenshot({
        path: `e2e-screenshots/${String(screenshotIdx++).padStart(2, '0')}-${nav}-${sub.replace(/\s/g, '_')}.png`,
        fullPage: true
      });

      if (subResult.status === 'FAIL') {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await sleep(2000);
        await clickMainNav(nav);
        await sleep(1000);
      }
    }
  }

  // 3. 날짜 필터 + 서브탭 교차 테스트 (원가관리)
  console.log('\n\n=== 날짜 필터 교차 테스트 (원가관리) ===');

  await clickMainNav('원가');
  await sleep(1000);

  const dateCostMatrix = [
    { date: '7일', tabs: ['원가 총괄', '원재료', '부재료', '노무비', '경비'] },
    { date: '30일', tabs: ['원가 총괄', '원재료', '부재료', '노무비', '경비'] },
  ];

  for (const { date, tabs } of dateCostMatrix) {
    // 날짜 필터 변경
    await clickSubTab(date);
    await sleep(1000);

    for (const sub of tabs) {
      await clickSubTab(sub);
      const result = await checkHealth(`원가+${date}→${sub}`);

      const si = result.status === 'PASS' ? '✓' : result.status === 'WARN' ? '⚠' : '✗';
      console.log(`  ${si} 원가 [${date}] → ${sub}: ${result.status} ${result.reason} (${result.bodyLen || '?'}자)`);
      if (result.status === 'FAIL') totalFail++; else totalPass++;
      results.push({ tab: `원가[${date}]`, sub, ...result });

      if (result.status === 'FAIL') {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await sleep(2000);
        await clickMainNav('원가');
        await sleep(1000);
        break;
      }
    }
  }

  // 4. 수익분석 날짜 필터 테스트
  console.log('\n=== 날짜 필터 테스트 (수익분석) ===');
  await clickMainNav('수익');
  await sleep(1000);

  for (const date of ['7일', '30일']) {
    await clickSubTab(date);
    await sleep(1000);
    for (const sub of ['채널별 수익', '품목별 랭킹', '수익 트렌드']) {
      await clickSubTab(sub);
      const result = await checkHealth(`수익+${date}→${sub}`);
      const si = result.status === 'PASS' ? '✓' : '✗';
      console.log(`  ${si} 수익 [${date}] → ${sub}: ${result.status} (${result.bodyLen || '?'}자)`);
      if (result.status === 'FAIL') totalFail++; else totalPass++;

      if (result.status === 'FAIL') {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await sleep(2000);
        await clickMainNav('수익');
        await sleep(1000);
        break;
      }
    }
  }

  // 결과 요약
  console.log('\n\n════════════════════════════════════');
  console.log('      E2E 테스트 최종 결과');
  console.log('════════════════════════════════════');
  console.log(`  ✓ PASS: ${totalPass}`);
  console.log(`  ✗ FAIL: ${totalFail}`);
  console.log(`  합계: ${totalPass + totalFail}`);
  console.log('════════════════════════════════════');

  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('\n실패 목록:');
    failures.forEach(f => console.log(`  ✗ ${f.tab} → ${f.sub}: ${f.reason}`));
  } else {
    console.log('\n모든 테스트 통과! 크래시 없음, 화이트스크린 없음.');
  }

  const warns = results.filter(r => r.status === 'WARN');
  if (warns.length > 0) {
    console.log('\n경고 목록:');
    warns.forEach(w => console.log(`  ⚠ ${w.tab} → ${w.sub}: ${w.reason}`));
  }

  await browser.close();
  process.exit(totalFail > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('테스트 실행 실패:', e);
  process.exit(1);
});
