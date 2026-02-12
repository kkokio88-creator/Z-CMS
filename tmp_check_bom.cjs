const {createClient}=require('@supabase/supabase-js');
const fs=require('fs');
const env=fs.readFileSync('.env','utf8');
const getEnv=(k)=>{const m=env.match(new RegExp(k+'=(.+)'));return m?m[1].trim():''};
const surl=getEnv('VITE_SUPABASE_URL');
const skey=getEnv('VITE_SUPABASE_ANON_KEY');
if(!surl||!skey){console.log('No creds');process.exit(0);}
const client=createClient(surl,skey);

async function main(){
  // BOM material codes
  const {data:allBom,error:bomErr}=await client.from('bom').select('material_code,product_code,production_qty,consumption_qty,additional_qty,material_name');
  if(bomErr){console.log('BOM error:',bomErr.message);return;}
  console.log('Total BOM rows:', allBom.length);

  const allMatCodes=[...new Set(allBom.map(b=>b.material_code))];
  console.log('Unique BOM material codes:', allMatCodes.length);
  console.log('Sample BOM mat codes:', allMatCodes.slice(0,15));

  const prefixes={};
  allMatCodes.forEach(c=>{const pfx=(c||'').split('_').slice(0,2).join('_');prefixes[pfx]=(prefixes[pfx]||0)+1;});
  console.log('BOM material prefixes:', prefixes);

  // Purchase codes
  const pData=JSON.parse(fs.readFileSync('tmp_purchases.json','utf8')).data;
  const purchaseCodes=[...new Set(pData.map(p=>p.product_code))];
  console.log('\nTotal unique purchase codes:', purchaseCodes.length);

  // Check overlap
  const overlap=purchaseCodes.filter(c=>allMatCodes.includes(c));
  console.log('OVERLAP (purchase codes in BOM):', overlap.length);
  console.log('Overlap sample:', overlap.slice(0,20));

  // Non-overlapping purchase codes
  const noMatch=purchaseCodes.filter(c=>!allMatCodes.includes(c));
  console.log('NO MATCH purchase codes:', noMatch.length);
  console.log('No match sample:', noMatch.slice(0,10));

  // BOM sample rows
  console.log('\nBOM sample rows:');
  allBom.slice(0,5).forEach(b=>console.log(JSON.stringify(b)));

  // Production totals
  const prodData=JSON.parse(fs.readFileSync('tmp_prod.json','utf8')).data;
  const totalProd=prodData.reduce((s,p)=>s+(p.prod_qty_total||0),0);
  console.log('\nTotal production (prodQtyTotal):', totalProd, 'from', prodData.length, 'days');

  // Simulate the BOM anomaly calculation
  const bomByMaterial = new Map();
  for(const bom of allBom){
    const matCode = (bom.material_code||'').trim();
    if(!matCode) continue;
    const consumption = (bom.consumption_qty||0) + (bom.additional_qty||0);
    const prodQty = bom.production_qty || 1;
    const entry = bomByMaterial.get(matCode) || {totalConsumption:0, totalProductionQty:0};
    entry.totalConsumption += consumption;
    entry.totalProductionQty += prodQty;
    bomByMaterial.set(matCode, entry);
  }

  console.log('\nbomByMaterial size:', bomByMaterial.size);

  // Check matching
  let matchCount=0, totalSpendMatch=0;
  const purchaseAgg = new Map();
  for(const p of pData){
    const code=(p.product_code||'').trim();
    if(!code) continue;
    const agg=purchaseAgg.get(code)||{totalQty:0,totalAmount:0};
    agg.totalQty+=p.quantity||0;
    agg.totalAmount+=p.total||0;
    purchaseAgg.set(code,agg);
  }

  for(const [matCode,bomInfo] of bomByMaterial){
    const pAgg=purchaseAgg.get(matCode);
    if(!pAgg) continue;
    matchCount++;
    totalSpendMatch+=pAgg.totalAmount;
    const bomRate=bomInfo.totalProductionQty>0?bomInfo.totalConsumption/bomInfo.totalProductionQty:0;
    const expectedQty=totalProd*bomRate;
    const actualQty=pAgg.totalQty;
    const deviation=expectedQty>0?((actualQty-expectedQty)/expectedQty)*100:0;
    if(matchCount<=5){
      console.log(`Match: ${matCode} | bomRate=${bomRate.toFixed(4)} expected=${expectedQty.toFixed(0)} actual=${actualQty} deviation=${deviation.toFixed(1)}% spend=${pAgg.totalAmount}`);
    }
  }
  console.log('\nTotal matching materials:', matchCount);
  console.log('Total spend of matching materials:', totalSpendMatch);
  console.log('Items with spend >= 50000:', [...bomByMaterial].filter(([k])=>purchaseAgg.has(k)&&purchaseAgg.get(k).totalAmount>=50000).length);
}

main().catch(e=>console.error(e));
