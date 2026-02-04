const http = require('http');

async function fetchSheet(sheetName) {
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

async function analyzeStructure() {
  const sheets = ['매출', '판매', '구매', '경비', '폐기'];

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Z-CMS Google Sheets 데이터 구조 분석                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  for (const sheet of sheets) {
    const result = await fetchSheet(sheet);
    if (result.success) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [${sheet}] 시트 - ${result.rowCount}행`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      console.log('\n📋 컬럼 구조:');
      const headers = result.headers || [];
      headers.forEach((h, i) => {
        if (h) {
          const values = result.data.slice(0, 10).map(r => r[h]).filter(v => v !== '' && v !== undefined);
          const isNumeric = values.length > 0 && values.every(v => typeof v === 'number');
          const hasDate = values.some(v => String(v).match(/^\d{4}[\/-]\d{2}[\/-]\d{2}/) || (typeof v === 'number' && v > 2020 && v < 2030));
          const type = hasDate ? '📅 날짜' : (isNumeric ? '🔢 숫자' : '📝 텍스트');
          console.log(`   ${i+1}. ${h} (${type})`);
        }
      });

      console.log('\n📄 샘플 데이터 (첫 2행):');
      result.data.slice(0, 2).forEach((row, i) => {
        const preview = Object.entries(row)
          .filter(([k, v]) => v !== '' && v !== undefined)
          .slice(0, 5)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
        console.log(`   ${i+1}. ${preview}`);
      });
    }
  }

  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    데이터 관계 분석                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // 데이터 관계 분석
  const 매출 = await fetchSheet('매출');
  const 판매 = await fetchSheet('판매');
  const 구매 = await fetchSheet('구매');
  const 경비 = await fetchSheet('경비');
  const 폐기 = await fetchSheet('폐기');

  console.log('🔗 키 필드 분석:');
  console.log('   • 판매 ↔ 구매: 품목코드로 연결 가능');
  console.log('   • 매출: 채널별(자사/쿠팡/컬리) 일별 매출');
  console.log('   • 경비: 전기/수도/가스 등 고정비');
  console.log('   • 폐기: 생산일별 폐기 데이터');

  // 품목코드 분석
  const 판매품목 = new Set(판매.data.map(r => r['품목코드']).filter(Boolean));
  const 구매품목 = new Set(구매.data.map(r => r['품목코드']).filter(Boolean));
  const 공통품목 = [...판매품목].filter(x => 구매품목.has(x));

  console.log(`\n📦 품목 분석:`);
  console.log(`   • 판매 품목 수: ${판매품목.size}개`);
  console.log(`   • 구매 품목 수: ${구매품목.size}개`);
  console.log(`   • 공통 품목 수: ${공통품목.length}개`);

  // 기간 분석
  const 판매날짜 = 판매.data.map(r => r['일별']).filter(Boolean);
  const 구매날짜 = 구매.data.map(r => r['일별']).filter(Boolean);

  console.log(`\n📅 기간 분석:`);
  console.log(`   • 판매 데이터: ${판매날짜.length > 0 ? 판매날짜[0] + ' ~ ' + 판매날짜[판매날짜.length-1] : 'N/A'}`);
  console.log(`   • 구매 데이터: ${구매날짜.length > 0 ? 구매날짜[0] + ' ~ ' + 구매날짜[구매날짜.length-1] : 'N/A'}`);

  // 채널 분석
  const 거래처 = new Set(판매.data.map(r => r['거래처별']).filter(Boolean));
  console.log(`\n🏪 거래처/채널:`);
  [...거래처].slice(0, 10).forEach(c => console.log(`   • ${c}`));
  if (거래처.size > 10) console.log(`   ... 외 ${거래처.size - 10}개`);
}

analyzeStructure().catch(console.error);
