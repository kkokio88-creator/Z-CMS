/**
 * 부재료 탭 크래시 디버깅 전용 테스트
 */
import { chromium } from 'playwright';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('  [PAGE ERROR]', err.message.slice(0, 200));
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('  [CONSOLE ERROR]', msg.text().slice(0, 200));
    }
  });

  console.log('1. 페이지 로드...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(3000);

  console.log('2. 원가관리 탭 클릭...');
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const t = await btn.textContent();
    if (t && t.includes('원가')) { await btn.click(); break; }
  }
  await sleep(2000);

  // 현재 상태 스크린샷
  await page.screenshot({ path: 'e2e-screenshots/debug-cost-main.png' });
  console.log('   원가관리 메인 OK');

  console.log('3. 원재료 탭 클릭...');
  const btns2 = await page.$$('button');
  for (const btn of btns2) {
    const t = (await btn.textContent() || '').trim();
    if (t === '원재료') { await btn.click(); break; }
  }
  await sleep(2000);
  await page.screenshot({ path: 'e2e-screenshots/debug-raw.png' });
  const rawLen = await page.evaluate(() => document.body.innerText.length);
  console.log(`   원재료 OK (${rawLen}자)`);

  console.log('4. 부재료 탭 클릭...');
  try {
    const btns3 = await page.$$('button');
    for (const btn of btns3) {
      const t = (await btn.textContent() || '').trim();
      if (t === '부재료') { await btn.click(); break; }
    }

    // 크래시 감지 대기
    await sleep(3000);

    // 화이트스크린 체크
    const bodyLen = await page.evaluate(() => document.body.innerText.length);
    console.log(`   부재료 렌더링: ${bodyLen}자`);

    if (bodyLen < 50) {
      console.log('   [FAIL] 화이트스크린!');
    } else {
      console.log('   [PASS] 부재료 정상 렌더링');
    }

    await page.screenshot({ path: 'e2e-screenshots/debug-sub.png' });
  } catch (e) {
    console.log(`   [CRASH] 부재료 크래시: ${e.message.slice(0, 200)}`);
    // 스크린샷 시도
    try {
      await page.screenshot({ path: 'e2e-screenshots/debug-sub-crash.png' });
    } catch {}
  }

  console.log('\n에러 목록:');
  if (errors.length === 0) {
    console.log('  없음');
  } else {
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.slice(0, 200)}`));
  }

  await browser.close();
}

main().catch(e => { console.error('실행 실패:', e); process.exit(1); });
