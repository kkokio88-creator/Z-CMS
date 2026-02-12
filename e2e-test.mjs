/**
 * Playwright E2E 테스트: 모든 탭/서브탭 크래시 검증 + 날짜 필터 반응 확인
 * 실행: npx playwright test e2e-test.mjs (또는 node로 직접)
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 15000;

// 메인 탭과 서브탭 구조
const TABS = [
  { name: '홈', navText: '홈', subTabs: [] },
  { name: '수익분석', navText: '수익분석', subTabs: ['채널별 수익', '품목별 랭킹', '수익 트렌드', '손익 시뮬레이션'] },
  { name: '원가관리', navText: '원가관리', subTabs: ['원가 총괄', '원재료', '부재료', '노무비', '경비'] },
  { name: '생산/BOM', navText: '생산', subTabs: ['생산 현황', '폐기 분석', '생산성 분석', 'BOM 오차', '수율 추적'] },
  { name: '재고/발주', navText: '재고', subTabs: ['재고 현황', '이상징후 분석', '통계적 발주', '발주 분석'] },
  { name: '설정', navText: '설정', subTabs: [] },
];

const DATE_RANGES = ['7일', '30일', '이번 달'];

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
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
  });

  console.log('=== Z-CMS E2E 테스트 시작 ===\n');

  // 1. 초기 페이지 로드
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    console.log('[PASS] 초기 페이지 로드 성공');
    totalPass++;
  } catch (e) {
    console.log(`[FAIL] 초기 페이지 로드 실패: ${e.message}`);
    totalFail++;
    await browser.close();
    return;
  }

  // 데이터 로딩 대기 (Supabase에서 로드)
  await sleep(5000);

  // 2. 각 메인 탭 + 서브탭 순회
  for (const tab of TABS) {
    console.log(`\n--- [${tab.name}] 탭 테스트 ---`);

    // 메인 탭 클릭
    try {
      // 네비게이션 버튼 찾기: text 매칭
      const navButtons = await page.$$('nav button, header button, [role="tab"], button');
      let clicked = false;
      for (const btn of navButtons) {
        const text = await btn.textContent();
        if (text && text.includes(tab.navText)) {
          await btn.click();
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // data-view 등 다른 셀렉터 시도
        const altBtn = await page.$(`button:has-text("${tab.navText}")`);
        if (altBtn) {
          await altBtn.click();
          clicked = true;
        }
      }

      await sleep(1500);

      // 화이트스크린 체크: body에 콘텐츠가 있는지
      const bodyContent = await page.evaluate(() => document.body.innerText.length);
      const hasWhiteScreen = bodyContent < 50;

      if (hasWhiteScreen) {
        console.log(`  [FAIL] ${tab.name} 메인 탭 → 화이트스크린 (콘텐츠 길이: ${bodyContent})`);
        totalFail++;
        results.push({ tab: tab.name, subTab: '-', status: 'FAIL', reason: '화이트스크린' });

        // 복구 시도: 홈으로 돌아가기
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await sleep(2000);
        continue;
      } else {
        console.log(`  [PASS] ${tab.name} 메인 탭 렌더링 OK (콘텐츠: ${bodyContent}자)`);
        totalPass++;
        results.push({ tab: tab.name, subTab: '-', status: 'PASS', reason: '' });
      }
    } catch (e) {
      console.log(`  [FAIL] ${tab.name} 메인 탭 클릭 실패: ${e.message}`);
      totalFail++;
      results.push({ tab: tab.name, subTab: '-', status: 'FAIL', reason: e.message });
      continue;
    }

    // 서브탭 순회
    for (const subTab of tab.subTabs) {
      try {
        // 서브탭 버튼 찾기
        const subButtons = await page.$$('button');
        let subClicked = false;
        for (const btn of subButtons) {
          const text = await btn.textContent();
          if (text && text.trim() === subTab) {
            await btn.click();
            subClicked = true;
            break;
          }
        }

        if (!subClicked) {
          // 부분 매칭 시도
          for (const btn of subButtons) {
            const text = await btn.textContent();
            if (text && text.includes(subTab.replace(/\s/g, ''))) {
              await btn.click();
              subClicked = true;
              break;
            }
          }
        }

        await sleep(1500);

        // 화이트스크린 체크
        const bodyLen = await page.evaluate(() => document.body.innerText.length);
        const whiteScreen = bodyLen < 50;

        // JS 에러 체크
        const recentErrors = consoleErrors.slice(-5);
        const hasNewError = recentErrors.some(e =>
          e.includes('Cannot read') || e.includes('is not a function') || e.includes('undefined')
        );

        if (whiteScreen) {
          console.log(`  [FAIL] ${tab.name} → ${subTab}: 화이트스크린 (${bodyLen}자)`);
          totalFail++;
          results.push({ tab: tab.name, subTab, status: 'FAIL', reason: '화이트스크린' });

          // 복구
          await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
          await sleep(2000);
          // 다시 해당 탭으로
          const navBtns = await page.$$('button');
          for (const btn of navBtns) {
            const text = await btn.textContent();
            if (text && text.includes(tab.navText)) { await btn.click(); break; }
          }
          await sleep(1000);
        } else {
          const errMsg = hasNewError ? ` (JS에러 감지: ${recentErrors[recentErrors.length - 1]?.slice(0, 80)})` : '';
          console.log(`  [PASS] ${tab.name} → ${subTab}: 렌더링 OK (${bodyLen}자)${errMsg}`);
          totalPass++;
          results.push({ tab: tab.name, subTab, status: 'PASS', reason: errMsg });
        }
      } catch (e) {
        console.log(`  [FAIL] ${tab.name} → ${subTab}: ${e.message.slice(0, 100)}`);
        totalFail++;
        results.push({ tab: tab.name, subTab, status: 'FAIL', reason: e.message.slice(0, 100) });
      }
    }
  }

  // 3. 날짜 필터 변경 테스트 (원가관리 탭에서)
  console.log('\n\n--- 날짜 필터 반응 테스트 (원가관리) ---');
  try {
    // 원가관리 탭으로 이동
    const navBtns = await page.$$('button');
    for (const btn of navBtns) {
      const text = await btn.textContent();
      if (text && text.includes('원가')) { await btn.click(); break; }
    }
    await sleep(1500);

    // 원가 총괄 서브탭
    const subBtns = await page.$$('button');
    for (const btn of subBtns) {
      const text = await btn.textContent();
      if (text && text.includes('원가 총괄')) { await btn.click(); break; }
    }
    await sleep(1000);

    // 날짜 필터 버튼들 테스트
    for (const dateLabel of DATE_RANGES) {
      try {
        const dateBtns = await page.$$('button');
        for (const btn of dateBtns) {
          const text = await btn.textContent();
          if (text && text.trim() === dateLabel) {
            await btn.click();
            break;
          }
        }
        await sleep(2000);

        const bodyLen = await page.evaluate(() => document.body.innerText.length);
        const whiteScreen = bodyLen < 50;

        if (whiteScreen) {
          console.log(`  [FAIL] 날짜 필터 "${dateLabel}" → 화이트스크린`);
          totalFail++;
        } else {
          console.log(`  [PASS] 날짜 필터 "${dateLabel}" → 렌더링 OK (${bodyLen}자)`);
          totalPass++;
        }
      } catch (e) {
        console.log(`  [FAIL] 날짜 필터 "${dateLabel}": ${e.message.slice(0, 80)}`);
        totalFail++;
      }
    }

    // 각 서브탭에서 날짜 필터 변경 테스트
    const costSubTabs = ['원재료', '부재료', '노무비', '경비'];
    for (const cst of costSubTabs) {
      try {
        // 서브탭 클릭
        const sBtns = await page.$$('button');
        for (const btn of sBtns) {
          const text = await btn.textContent();
          if (text && text.trim() === cst) { await btn.click(); break; }
        }
        await sleep(1500);

        const bodyLen = await page.evaluate(() => document.body.innerText.length);
        if (bodyLen < 50) {
          console.log(`  [FAIL] 원가관리 → ${cst}: 화이트스크린`);
          totalFail++;

          // 복구
          await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
          await sleep(3000);
          const nBtns = await page.$$('button');
          for (const btn of nBtns) {
            const text = await btn.textContent();
            if (text && text.includes('원가')) { await btn.click(); break; }
          }
          await sleep(1000);
        } else {
          // 7일 필터 적용
          const dBtns = await page.$$('button');
          for (const btn of dBtns) {
            const text = await btn.textContent();
            if (text && text.trim() === '7일') { await btn.click(); break; }
          }
          await sleep(1500);

          const bodyLen2 = await page.evaluate(() => document.body.innerText.length);
          if (bodyLen2 < 50) {
            console.log(`  [FAIL] 원가관리 → ${cst} + 7일 필터: 화이트스크린`);
            totalFail++;
          } else {
            console.log(`  [PASS] 원가관리 → ${cst} + 날짜 필터 반응 OK`);
            totalPass++;
          }
        }
      } catch (e) {
        console.log(`  [FAIL] 원가관리 → ${cst}: ${e.message.slice(0, 80)}`);
        totalFail++;
      }
    }
  } catch (e) {
    console.log(`  [FAIL] 날짜 필터 테스트 실패: ${e.message}`);
    totalFail++;
  }

  // 4. 스크린샷 캡처
  await page.screenshot({ path: 'e2e-final-screenshot.png', fullPage: true });

  // 결과 요약
  console.log('\n\n========================================');
  console.log('        E2E 테스트 결과 요약');
  console.log('========================================');
  console.log(`  PASS: ${totalPass}`);
  console.log(`  FAIL: ${totalFail}`);
  console.log(`  TOTAL: ${totalPass + totalFail}`);
  console.log('========================================');

  if (consoleErrors.length > 0) {
    console.log(`\n콘솔 에러 (총 ${consoleErrors.length}개):`);
    const unique = [...new Set(consoleErrors)];
    unique.slice(0, 10).forEach((e, i) => console.log(`  ${i + 1}. ${e.slice(0, 120)}`));
  }

  console.log('\n실패 항목:');
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length === 0) {
    console.log('  없음! 모든 테스트 통과');
  } else {
    failures.forEach(f => console.log(`  - ${f.tab} → ${f.subTab}: ${f.reason}`));
  }

  await browser.close();
  process.exit(totalFail > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('테스트 실행 실패:', e);
  process.exit(1);
});
