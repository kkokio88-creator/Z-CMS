/**
 * 부재료 크래시 디버깅: 모든 콘솔 로그/에러 캡처
 */
import { chromium } from 'playwright';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 모든 콘솔 메시지 캡처
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`  [${msg.type().toUpperCase()}] ${msg.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', err => {
    console.log(`  [PAGE ERROR] ${err.message.slice(0, 500)}`);
    console.log(`  [STACK] ${err.stack?.slice(0, 500)}`);
  });

  console.log('1. 로드...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(5000);

  console.log('2. 원가 관리 클릭...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent?.includes('원가 관리') || b.textContent?.includes('원가관리')) {
        b.click();
        return;
      }
    }
  });
  await sleep(2000);
  console.log('   OK. 현재 콘텐츠:', (await page.evaluate(() => document.body.innerText.length)), '자');

  console.log('3. 부재료 서브탭 클릭...');
  // DOM에서 직접 서브탭 찾기
  const subTabInfo = await page.evaluate(() => {
    const navs = document.querySelectorAll('nav');
    const info = [];
    for (const nav of navs) {
      const btns = nav.querySelectorAll('button');
      btns.forEach(b => {
        info.push({ text: b.textContent?.trim(), classes: nav.className });
      });
    }
    return info;
  });
  console.log('   서브탭 버튼들:', JSON.stringify(subTabInfo.filter(x => x.text), null, 2));

  // 직접 클릭
  await page.evaluate(() => {
    const navs = document.querySelectorAll('nav');
    for (const nav of navs) {
      const btns = nav.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent?.includes('부재료')) {
          console.log('clicking 부재료 button');
          b.click();
          return 'clicked';
        }
      }
    }
    return 'not found';
  });

  console.log('   클릭 후 대기...');
  await sleep(3000);

  try {
    const bodyLen = await page.evaluate(() => document.body.innerText.length);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log(`   콘텐츠 길이: ${bodyLen}자`);
    console.log(`   콘텐츠 앞부분: ${bodyText}`);
    await page.screenshot({ path: 'e2e-screenshots/debug-sub-v3.png', fullPage: true });
  } catch (e) {
    console.log(`   페이지 크래시: ${e.message.slice(0, 200)}`);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
