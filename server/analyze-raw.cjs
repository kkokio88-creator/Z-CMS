const http = require('http');

async function fetchRawPreview(sheetName, rows = 15) {
  return new Promise((resolve) => {
    const url = `/api/sheets/preview?url=1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI&sheet=${encodeURIComponent(sheetName)}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: url,
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.end();
  });
}

async function fetchFullData(sheetName) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      spreadsheetUrl: '1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI',
      sheetName
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/sheets/fetch-data',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.write(data);
    req.end();
  });
}

async function analyze() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║           Z-CMS Google Sheets 상세 데이터 구조 분석                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  const sheets = ['매출', '판매', '구매', '경비', '폐기'];

  for (const sheet of sheets) {
    console.log(`\n\n${'═'.repeat(76)}`);
    console.log(`📊 [${sheet}] 시트 원본 데이터`);
    console.log('═'.repeat(76));

    const preview = await fetchRawPreview(sheet);

    if (preview.success) {
      console.log('\n📋 헤더 행:');
      console.log('   ' + (preview.headers || []).slice(0, 8).join(' | '));

      console.log('\n📄 데이터 미리보기:');
      (preview.data || []).forEach((row, i) => {
        const rowStr = (row || []).slice(0, 6).map(c => String(c || '').substring(0, 15)).join(' | ');
        console.log(`   ${i+1}. ${rowStr}`);
      });
    }
  }

  // 구매 데이터 상세 분석 (가장 깔끔한 시트)
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      구매 데이터 상세 분석                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  const 구매 = await fetchFullData('구매');
  if (구매.success && 구매.data.length > 0) {
    // 품목별 구매 통계
    const 품목통계 = {};
    구매.data.forEach(row => {
      const 품목 = row['품목별'];
      if (품목) {
        if (!품목통계[품목]) {
          품목통계[품목] = { 총수량: 0, 총금액: 0, 건수: 0, 코드: row['품목코드'] };
        }
        품목통계[품목].총수량 += (row['수량'] || 0);
        품목통계[품목].총금액 += (row['합계'] || row['공급가액'] || 0);
        품목통계[품목].건수 += 1;
      }
    });

    // 상위 10개 품목
    const 상위품목 = Object.entries(품목통계)
      .sort((a, b) => b[1].총금액 - a[1].총금액)
      .slice(0, 10);

    console.log('\n💰 구매 금액 상위 10개 품목:');
    상위품목.forEach(([품목, 통계], i) => {
      console.log(`   ${i+1}. ${품목} (${통계.코드})`);
      console.log(`      수량: ${통계.총수량.toLocaleString()} | 금액: ${통계.총금액.toLocaleString()}원 | 건수: ${통계.건수}`);
    });

    // 총계
    const 총구매금액 = Object.values(품목통계).reduce((sum, s) => sum + s.총금액, 0);
    const 총품목수 = Object.keys(품목통계).length;
    console.log(`\n📊 구매 요약:`);
    console.log(`   • 총 품목 수: ${총품목수}개`);
    console.log(`   • 총 구매 금액: ${총구매금액.toLocaleString()}원`);
    console.log(`   • 총 거래 건수: ${구매.data.length}건`);
  }

  // 에이전트 활용 방안
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    에이전트별 데이터 활용 방안                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏭 BOM/Waste 팀 (정-반-합)                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ • 데이터: 구매(원자재), 폐기                                                │
│ • 분석: 원자재 투입 대비 폐기율 계산                                        │
│ • 인사이트: BOM 정확도, 과잉 구매 품목, 폐기 감소 방안                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📦 Inventory 팀 (정-반-합)                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ • 데이터: 구매, 판매                                                        │
│ • 분석: 재고 회전율, 안전재고 수준, 발주점                                  │
│ • 인사이트: 과잉/부족 재고 품목, 발주 최적화                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 Profitability 팀 (정-반-합)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ • 데이터: 매출, 판매, 구매, 경비                                            │
│ • 분석: 채널별 수익성, 품목별 마진율                                        │
│ • 인사이트: 고수익 채널/품목, 원가 절감 포인트                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 Cost 팀 (정-반-합)                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ • 데이터: 경비, 구매                                                        │
│ • 분석: 고정비/변동비 추이, 원가 구조                                       │
│ • 인사이트: 비용 절감 기회, 예산 대비 실적                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 👑 Chief Orchestrator                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ • 역할: 모든 팀의 분석 결과 통합 및 의사결정 지원                           │
│ • 크로스 도메인 인사이트 도출                                               │
│ • 예: "폐기율 증가 + 매출 감소 = 수요 예측 개선 필요"                       │
└─────────────────────────────────────────────────────────────────────────────┘
`);
}

analyze().catch(console.error);
