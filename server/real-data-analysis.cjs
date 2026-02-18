const http = require('http');

// API 호출 헬퍼
function apiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 시트 데이터 가져오기
async function fetchSheetData(sheetName) {
  return apiCall('POST', '/api/sheets/fetch-data', {
    spreadsheetUrl: '1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI',
    sheetName
  });
}

// 데이터 분석 함수들
function analyzePurchaseData(data) {
  const items = {};
  let totalAmount = 0;

  data.forEach(row => {
    const item = row['품목별'] || row['품목명'];
    const code = row['품목코드'];
    const amount = row['합계'] || row['공급가액'] || 0;
    const qty = row['수량'] || 0;
    const unitPrice = row['단가'] || 0;

    if (item) {
      if (!items[item]) {
        items[item] = { code, totalQty: 0, totalAmount: 0, count: 0, avgPrice: 0 };
      }
      items[item].totalQty += qty;
      items[item].totalAmount += amount;
      items[item].count += 1;
    }
    totalAmount += amount;
  });

  // 평균 단가 계산
  Object.values(items).forEach(i => {
    i.avgPrice = i.totalQty > 0 ? Math.round(i.totalAmount / i.totalQty) : 0;
  });

  // 상위 품목 정렬
  const topByAmount = Object.entries(items)
    .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
    .slice(0, 10)
    .map(([name, data]) => ({ name, ...data }));

  return { totalAmount, itemCount: Object.keys(items).length, topByAmount, items };
}

function analyzeSalesData(data) {
  const byCustomer = {};
  const byItem = {};
  let totalCount = 0;

  data.forEach(row => {
    const customer = row['거래처별'];
    const item = row['품목명'];
    const code = row['품목코드'];

    if (customer) {
      byCustomer[customer] = (byCustomer[customer] || 0) + 1;
    }
    if (item && code) {
      if (!byItem[code]) {
        byItem[code] = { name: item, count: 0 };
      }
      byItem[code].count += 1;
    }
    totalCount++;
  });

  const topCustomers = Object.entries(byCustomer)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topItems = Object.entries(byItem)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([code, data]) => ({ code, ...data }));

  return { totalCount, customerCount: Object.keys(byCustomer).length, topCustomers, topItems };
}

function analyzeWasteData(data) {
  const dailyWaste = [];

  data.forEach(row => {
    const date = row['생산일'];
    const total = row['생산수량'] || row['생산수량\n(EA)'];
    const regular = row['일반반찬'] || 0;
    const preProcess = row['전전처리'] || 0;
    const frozen = row['냉동국'] || 0;
    const sauce = row['소스'] || 0;
    const bibimbap = row['비빔밥'] || 0;

    if (date && typeof date === 'string' && date.match(/\d{4}-\d{2}-\d{2}/)) {
      dailyWaste.push({
        date,
        total: total || 0,
        regular,
        preProcess,
        frozen,
        sauce,
        bibimbap
      });
    }
  });

  // 최근 데이터 정렬
  dailyWaste.sort((a, b) => b.date.localeCompare(a.date));

  const totalProduction = dailyWaste.reduce((sum, d) => sum + (d.total || 0), 0);
  const avgDaily = dailyWaste.length > 0 ? Math.round(totalProduction / dailyWaste.length) : 0;

  return {
    recordCount: dailyWaste.length,
    totalProduction,
    avgDaily,
    recent: dailyWaste.slice(0, 10)
  };
}

function analyzeRevenueData(data) {
  const dailyRevenue = [];

  data.forEach(row => {
    const date = row['생산일'];
    const jasa = row['자사\n(권장판매가)'] || row['자사'] || 0;
    const coupang = row['쿠팡\n(공급가)'] || row['쿠팡'] || 0;
    const kurly = row['컬리\n(공급가)'] || row['컬리'] || 0;
    const total = row['매출 총액'] || row['매출총액'] || 0;

    if (date && typeof date === 'string' && date.match(/\d{4}-\d{2}-\d{2}/)) {
      dailyRevenue.push({ date, jasa, coupang, kurly, total });
    }
  });

  dailyRevenue.sort((a, b) => b.date.localeCompare(a.date));

  const totalRevenue = dailyRevenue.reduce((sum, d) => sum + (d.total || 0), 0);
  const byChannel = {
    jasa: dailyRevenue.reduce((sum, d) => sum + (d.jasa || 0), 0),
    coupang: dailyRevenue.reduce((sum, d) => sum + (d.coupang || 0), 0),
    kurly: dailyRevenue.reduce((sum, d) => sum + (d.kurly || 0), 0)
  };

  return {
    recordCount: dailyRevenue.length,
    totalRevenue,
    byChannel,
    recent: dailyRevenue.slice(0, 10)
  };
}

// 메인 분석 함수
async function runAnalysis() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║              Z-CMS 실제 데이터 기반 종합 분석                            ║');
  console.log('║                    2026년 기초데이터 분석                                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  // 1. 데이터 수집
  console.log('\n📥 데이터 수집 중...\n');

  const [매출Result, 판매Result, 구매Result, 폐기Result] = await Promise.all([
    fetchSheetData('매출'),
    fetchSheetData('판매'),
    fetchSheetData('구매'),
    fetchSheetData('폐기')
  ]);

  const 매출 = 매출Result.success ? 매출Result.data : [];
  const 판매 = 판매Result.success ? 판매Result.data : [];
  const 구매 = 구매Result.success ? 구매Result.data : [];
  const 폐기 = 폐기Result.success ? 폐기Result.data : [];

  console.log(`   ✓ 매출: ${매출.length}건`);
  console.log(`   ✓ 판매: ${판매.length}건`);
  console.log(`   ✓ 구매: ${구매.length}건`);
  console.log(`   ✓ 폐기: ${폐기.length}건`);

  // 2. 데이터 분석
  console.log('\n📊 데이터 분석 중...\n');

  const purchaseAnalysis = analyzePurchaseData(구매);
  const salesAnalysis = analyzeSalesData(판매);
  const wasteAnalysis = analyzeWasteData(폐기);
  const revenueAnalysis = analyzeRevenueData(매출);

  // 3. 분석 결과 출력
  console.log('═'.repeat(76));
  console.log('💰 [1] 구매/원가 분석');
  console.log('═'.repeat(76));
  console.log(`\n   총 구매 금액: ${purchaseAnalysis.totalAmount.toLocaleString()}원`);
  console.log(`   구매 품목 수: ${purchaseAnalysis.itemCount}개`);
  console.log('\n   📈 구매 금액 TOP 10:');
  purchaseAnalysis.topByAmount.forEach((item, i) => {
    console.log(`   ${(i+1).toString().padStart(2)}. ${item.name.padEnd(25)} ${item.totalAmount.toLocaleString().padStart(15)}원 (${item.totalQty.toLocaleString()}개, 평균 ${item.avgPrice.toLocaleString()}원)`);
  });

  console.log('\n' + '═'.repeat(76));
  console.log('🛒 [2] 판매 분석');
  console.log('═'.repeat(76));
  console.log(`\n   총 판매 건수: ${salesAnalysis.totalCount.toLocaleString()}건`);
  console.log(`   거래처 수: ${salesAnalysis.customerCount}개`);
  console.log('\n   🏪 거래처별 판매 TOP 5:');
  salesAnalysis.topCustomers.forEach((c, i) => {
    console.log(`   ${i+1}. ${c.name.substring(0, 30).padEnd(32)} ${c.count.toLocaleString().padStart(6)}건`);
  });
  console.log('\n   📦 품목별 판매 TOP 10:');
  salesAnalysis.topItems.forEach((item, i) => {
    console.log(`   ${(i+1).toString().padStart(2)}. [${item.code}] ${item.name.substring(0, 25).padEnd(27)} ${item.count.toLocaleString().padStart(5)}건`);
  });

  console.log('\n' + '═'.repeat(76));
  console.log('🏭 [3] 생산/폐기 분석');
  console.log('═'.repeat(76));
  console.log(`\n   기록 일수: ${wasteAnalysis.recordCount}일`);
  console.log(`   총 생산량: ${wasteAnalysis.totalProduction.toLocaleString()}EA`);
  console.log(`   일평균 생산량: ${wasteAnalysis.avgDaily.toLocaleString()}EA`);
  if (wasteAnalysis.recent.length > 0) {
    console.log('\n   📅 최근 생산 기록:');
    wasteAnalysis.recent.slice(0, 5).forEach(d => {
      console.log(`   ${d.date}: 총 ${(d.total || 0).toLocaleString()}EA (일반반찬: ${d.regular}, 전전처리: ${d.preProcess}, 냉동국: ${d.frozen})`);
    });
  }

  console.log('\n' + '═'.repeat(76));
  console.log('📈 [4] 매출 분석');
  console.log('═'.repeat(76));
  console.log(`\n   기록 일수: ${revenueAnalysis.recordCount}일`);
  console.log(`   총 매출액: ${revenueAnalysis.totalRevenue.toLocaleString()}원`);
  console.log('\n   🏪 채널별 매출:');
  console.log(`   • 자사(고도몰): ${revenueAnalysis.byChannel.jasa.toLocaleString()}원`);
  console.log(`   • 쿠팡: ${revenueAnalysis.byChannel.coupang.toLocaleString()}원`);
  console.log(`   • 컬리: ${revenueAnalysis.byChannel.kurly.toLocaleString()}원`);

  // 4. 크로스 도메인 인사이트
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     🧠 AI 에이전트 인사이트                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  // 원가율 계산
  const costRatio = revenueAnalysis.totalRevenue > 0
    ? ((purchaseAnalysis.totalAmount / revenueAnalysis.totalRevenue) * 100).toFixed(1)
    : 0;

  // 품목당 평균 거래
  const avgTransPerItem = purchaseAnalysis.itemCount > 0
    ? Math.round(구매.length / purchaseAnalysis.itemCount)
    : 0;

  console.log('\n┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 💡 BOM/Waste 팀 인사이트                                                │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ • 총 ${purchaseAnalysis.itemCount}개 원자재 중 상위 10개가 구매 금액의 상당 부분 차지`);
  console.log(`│ • 소고기(잡육), 애호박, 깐메추리알 등 고가 원자재 집중 관리 필요`);
  console.log(`│ • 품목당 평균 ${avgTransPerItem}회 구매 → 발주 주기 최적화 검토`);
  console.log('│ • 권고: 상위 10개 품목 대상 대체재 검토 및 단가 협상 우선 진행');
  console.log('└─────────────────────────────────────────────────────────────────────────┘');

  console.log('\n┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 📦 Inventory 팀 인사이트                                                │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ • ${salesAnalysis.topItems.length}개 주요 판매 품목 식별`);
  console.log(`│ • 쿠팡(포워드벤처스) 중심 판매 채널 구조`);
  console.log(`│ • 장아찌/피클류 제품이 판매 상위권 차지`);
  console.log('│ • 권고: 주요 판매 품목 안전재고 수준 재설정 및 리드타임 분석');
  console.log('└─────────────────────────────────────────────────────────────────────────┘');

  console.log('\n┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 💰 Profitability 팀 인사이트                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  if (revenueAnalysis.totalRevenue > 0) {
    console.log(`│ • 원자재 구매비/매출 비율: ${costRatio}%`);
    const channelShare = {
      jasa: ((revenueAnalysis.byChannel.jasa / revenueAnalysis.totalRevenue) * 100).toFixed(1),
      coupang: ((revenueAnalysis.byChannel.coupang / revenueAnalysis.totalRevenue) * 100).toFixed(1),
      kurly: ((revenueAnalysis.byChannel.kurly / revenueAnalysis.totalRevenue) * 100).toFixed(1)
    };
    console.log(`│ • 채널 비중: 자사 ${channelShare.jasa}% | 쿠팡 ${channelShare.coupang}% | 컬리 ${channelShare.kurly}%`);
  }
  console.log('│ • 권고: 채널별 마진율 분석 및 저마진 채널 가격 재협상 검토');
  console.log('└─────────────────────────────────────────────────────────────────────────┘');

  console.log('\n┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 📊 Cost 팀 인사이트                                                     │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ • 일평균 생산량: ${wasteAnalysis.avgDaily.toLocaleString()}EA`);
  console.log(`│ • 구매 총액 대비 주요 품목 비중 분석 필요`);
  console.log('│ • 경비(전기/수도/가스) 데이터 연동 시 정확한 원가 구조 파악 가능');
  console.log('│ • 권고: 생산량 대비 원자재 투입량 비교 → BOM 정확도 검증');
  console.log('└─────────────────────────────────────────────────────────────────────────┘');

  // 5. 종합 권고사항
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    👑 Chief Orchestrator 종합 권고                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 즉시 실행 항목 (Quick Wins)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. 구매 금액 상위 10개 품목 단가 재협상 추진                                │
│ 2. 쿠팡/컬리 거래조건 분석 → 채널별 수익성 비교표 작성                      │
│ 3. 장아찌/피클류 안전재고 수준 검토 (현재 Shortage 상태 다수)               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📈 중기 개선 과제 (1-3개월)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. BOM 정확도 검증: 생산량 vs 원자재 투입량 비교 분석                       │
│ 2. 품목별 마진율 분석 대시보드 구축                                         │
│ 3. 수요 예측 모델 개발 → 발주 최적화                                        │
│ 4. 경비 데이터(전기/수도/가스) 정규화 및 연동                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 추가 데이터 요구사항                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ • 매출 시트: 실제 일별 매출 데이터 입력 필요 (현재 대부분 0)                │
│ • 경비 시트: 일별 전기/수도/가스 검침 데이터 정규화                         │
│ • BOM 시트: 제품별 원자재 소요량 명세 추가 권장                             │
└─────────────────────────────────────────────────────────────────────────────┘
`);

  // 6. 에이전트 토론 요청
  console.log('\n📡 에이전트 토론 요청 중...\n');

  const contextData = {
    purchase: {
      totalAmount: purchaseAnalysis.totalAmount,
      itemCount: purchaseAnalysis.itemCount,
      topItems: purchaseAnalysis.topByAmount.slice(0, 5)
    },
    sales: {
      totalCount: salesAnalysis.totalCount,
      customerCount: salesAnalysis.customerCount,
      topCustomers: salesAnalysis.topCustomers,
      topItems: salesAnalysis.topItems.slice(0, 5)
    },
    waste: {
      recordCount: wasteAnalysis.recordCount,
      totalProduction: wasteAnalysis.totalProduction,
      avgDaily: wasteAnalysis.avgDaily
    },
    revenue: {
      totalRevenue: revenueAnalysis.totalRevenue,
      byChannel: revenueAnalysis.byChannel
    },
    insights: {
      costRatio,
      avgTransPerItem
    }
  };

  // 팀별 토론 요청
  const debateResult = await apiCall('POST', '/api/debates/all-teams', {
    priority: 'high',
    contextData
  });

  console.log('   토론 요청 결과:', debateResult.success ? '✓ 성공' : '✗ 실패');
  if (debateResult.data) {
    console.log('   참여 팀:', debateResult.data.teams?.join(', '));
  }

  console.log('\n✅ 분석 완료!\n');
}

runAnalysis().catch(console.error);
