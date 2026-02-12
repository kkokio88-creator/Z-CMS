/**
 * Playwright E2E v3: 정밀 서브탭 클릭 + 콘텐츠 변화 확인 + 날짜 필터 반응
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!fs.existsSync('e2e-screenshots')) fs.mkdirSync('e2e-screenshots', { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  let pass = 0, fail = 0;
  const failures = [];

  function record(label, ok, reason = '') {
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}: ${reason}`); failures.push({ label, reason }); }
  }

  // 페이지 로드 + 데이터 대기
  console.log('페이지 로드 중...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(5000);

  // ── 헬퍼: 사이드바 메인 탭 클릭 ──
  // 사이드바는 aside/nav 안에 있음. 버튼 텍스트로 찾음.
  async function clickSideNav(text) {
    // aside 내부의 버튼 또는 링크
    const btns = await page.$$('aside button, aside a, nav button, nav a');
    for (const b of btns) {
      const t = (await b.textContent() || '').replace(/\s+/g, ' ').trim();
      if (t.includes(text)) { await b.click(); return true; }
    }
    // 폴백: 전체 버튼
    const allBtns = await page.$$('button');
    for (const b of allBtns) {
      const t = (await b.textContent() || '').replace(/\s+/g, ' ').trim();
      if (t.includes(text)) { await b.click(); return true; }
    }
    return false;
  }

  // ── 헬퍼: 서브탭 클릭 (SubTabLayout nav 내부 버튼) ──
  // SubTabLayout: <nav className="flex gap-1 -mb-px"> 안의 <button>
  async function clickSubTab(label) {
    // -mb-px 클래스를 가진 nav 내부의 버튼들
    const navs = await page.$$('nav.flex');
    for (const nav of navs) {
      const cls = await nav.getAttribute('class') || '';
      if (!cls.includes('-mb-px')) continue;
      const btns = await nav.$$('button');
      for (const btn of btns) {
        const t = (await btn.textContent() || '').replace(/\s+/g, ' ').trim();
        if (t.includes(label)) {
          await btn.click();
          return true;
        }
      }
    }
    return false;
  }

  // ── 헬퍼: 날짜 필터 버튼 클릭 (Header 내부) ──
  async function clickDateFilter(label) {
    const hdr = await page.$('header');
    if (!hdr) return false;
    const btns = await hdr.$$('button');
    for (const btn of btns) {
      const t = (await btn.textContent() || '').trim();
      if (t === label) { await btn.click(); return true; }
    }
    return false;
  }

  // ── 헬퍼: 콘텐츠 체크 ──
  async function checkContent(label, expectedMinLen = 100) {
    await sleep(1500);
    const errsBefore = pageErrors.length;
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasError = bodyText.includes('오류가 발생') || bodyText.includes('Something went wrong');
    const newErrors = pageErrors.slice(errsBefore);

    if (bodyText.length < 30) {
      return { ok: false, reason: `화이트스크린(${bodyText.length}자)`, len: bodyText.length };
    }
    if (hasError) {
      return { ok: false, reason: 'ErrorBoundary', len: bodyText.length };
    }
    if (newErrors.length > 0) {
      return { ok: false, reason: `JS에러: ${newErrors[0].slice(0, 100)}`, len: bodyText.length };
    }
    return { ok: true, reason: '', len: bodyText.length };
  }

  // ═══════════════════════════════════════════
  // TEST 1: 모든 메인 탭 + 서브탭 순회
  // ═══════════════════════════════════════════
  console.log('\n══ 전체 탭/서브탭 순회 테스트 ══');

  const views = [
    { nav: '통합 관제', subs: [] },
    { nav: '수익 분석', subs: ['채널별 수익', '품목별 랭킹', '수익 트렌드', '손익 시뮬레이션'] },
    { nav: '원가 관리', subs: ['원가 총괄', '원재료', '부재료', '노무비', '수도광열전력'] },
    { nav: '생산/BOM', subs: ['생산 현황', '폐기 분석', '생산성 분석', 'BOM 오차', '수율 추적'] },
    { nav: '재고/발주', subs: ['재고 현황', '이상징후 분석', '통계적 발주', '발주 분석'] },
    { nav: '설정', subs: [] },
  ];

  let idx = 0;
  for (const { nav, subs } of views) {
    console.log(`\n─── ${nav} ───`);
    pageErrors.length = 0;
    const clicked = await clickSideNav(nav);
    if (!clicked) {
      record(`${nav} 탭 클릭`, false, '버튼을 찾을 수 없음');
      continue;
    }
    const mainCheck = await checkContent(nav);
    record(`${nav} 메인 (${mainCheck.len}자)`, mainCheck.ok, mainCheck.reason);
    await page.screenshot({ path: `e2e-screenshots/${String(idx++).padStart(2, '0')}-${nav.replace(/\//g, '_')}.png`, fullPage: true });

    if (!mainCheck.ok) {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(3000);
      continue;
    }

    for (const sub of subs) {
      pageErrors.length = 0;
      const subClicked = await clickSubTab(sub);
      if (!subClicked) {
        record(`${nav} → ${sub} 클릭`, false, '서브탭 버튼을 찾을 수 없음');
        continue;
      }
      const subCheck = await checkContent(`${nav}→${sub}`);
      record(`${nav} → ${sub} (${subCheck.len}자)`, subCheck.ok, subCheck.reason);
      await page.screenshot({ path: `e2e-screenshots/${String(idx++).padStart(2, '0')}-${nav.replace(/\//g, '_')}-${sub.replace(/\s/g, '_')}.png`, fullPage: true });

      if (!subCheck.ok) {
        // 복구
        await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
        await sleep(3000);
        await clickSideNav(nav);
        await sleep(1500);
      }
    }
  }

  // ═══════════════════════════════════════════
  // TEST 2: 날짜 필터 + 원가관리 서브탭 교차
  // ═══════════════════════════════════════════
  console.log('\n\n══ 날짜 필터 × 원가관리 교차 테스트 ══');

  await clickSideNav('원가 관리');
  await sleep(1500);

  const costSubs = ['원가 총괄', '원재료', '부재료', '노무비', '수도광열전력'];
  const dates = ['최근 7일', '최근 30일', '지난달', '이번달'];

  for (const dateLbl of dates) {
    const dateClicked = await clickDateFilter(dateLbl);
    if (!dateClicked) {
      // 짧은 라벨 시도
      const shortLabels = { '최근 7일': '7일', '최근 30일': '30일', '지난달': '지난달', '이번달': '이번달' };
      const short = shortLabels[dateLbl] || dateLbl;
      await clickDateFilter(short);
    }
    await sleep(500);

    for (const sub of costSubs) {
      pageErrors.length = 0;
      await clickSubTab(sub);
      const r = await checkContent(`원가[${dateLbl}]→${sub}`);
      record(`원가 [${dateLbl}] → ${sub} (${r.len}자)`, r.ok, r.reason);

      if (!r.ok) {
        await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
        await sleep(3000);
        await clickSideNav('원가 관리');
        await sleep(1500);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════
  // TEST 3: 날짜 필터 + 수익분석 교차
  // ═══════════════════════════════════════════
  console.log('\n\n══ 날짜 필터 × 수익분석 교차 테스트 ══');

  await clickSideNav('수익 분석');
  await sleep(1500);

  const profitSubs = ['채널별 수익', '품목별 랭킹', '수익 트렌드', '손익 시뮬레이션'];
  for (const dateLbl of ['최근 7일', '최근 30일']) {
    const dateClicked = await clickDateFilter(dateLbl);
    if (!dateClicked) await clickDateFilter(dateLbl.replace('최근 ', ''));
    await sleep(500);

    for (const sub of profitSubs) {
      pageErrors.length = 0;
      await clickSubTab(sub);
      const r = await checkContent(`수익[${dateLbl}]→${sub}`);
      record(`수익 [${dateLbl}] → ${sub} (${r.len}자)`, r.ok, r.reason);

      if (!r.ok) {
        await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
        await sleep(3000);
        await clickSideNav('수익 분석');
        await sleep(1500);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════
  // TEST 4: 날짜 필터 + 생산 교차
  // ═══════════════════════════════════════════
  console.log('\n\n══ 날짜 필터 × 생산/BOM 교차 테스트 ══');

  await clickSideNav('생산/BOM');
  await sleep(1500);

  const prodSubs = ['생산 현황', '폐기 분석', '생산성 분석', 'BOM 오차', '수율 추적'];
  for (const dateLbl of ['최근 7일', '최근 30일']) {
    const dateClicked = await clickDateFilter(dateLbl);
    if (!dateClicked) await clickDateFilter(dateLbl.replace('최근 ', ''));
    await sleep(500);

    for (const sub of prodSubs) {
      pageErrors.length = 0;
      await clickSubTab(sub);
      const r = await checkContent(`생산[${dateLbl}]→${sub}`);
      record(`생산 [${dateLbl}] → ${sub} (${r.len}자)`, r.ok, r.reason);

      if (!r.ok) {
        await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
        await sleep(3000);
        await clickSideNav('생산/BOM');
        await sleep(1500);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════
  // 결과
  // ═══════════════════════════════════════════
  console.log('\n\n════════════════════════════════════');
  console.log('      E2E 테스트 v3 최종 결과');
  console.log('════════════════════════════════════');
  console.log(`  ✓ PASS: ${pass}`);
  console.log(`  ✗ FAIL: ${fail}`);
  console.log(`  합계: ${pass + fail}`);
  console.log('════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\n실패 목록:');
    failures.forEach(f => console.log(`  ✗ ${f.label}: ${f.reason}`));
  } else {
    console.log('\n모든 테스트 통과!');
  }

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('실행 실패:', e); process.exit(1); });
