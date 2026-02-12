// Supabase 데이터 확인 스크립트
const {createClient}=require('@supabase/supabase-js');
const fs=require('fs');
const env=fs.readFileSync('.env','utf8');
const getEnv=(k)=>{const m=env.match(new RegExp(k+'=(.+)'));return m?m[1].trim():''};
const surl=getEnv('VITE_SUPABASE_URL');
const skey=getEnv('VITE_SUPABASE_ANON_KEY');
if(!surl||!skey){console.log('No creds');process.exit(0);}
const client=createClient(surl,skey);

async function main(){
  const tables = ['daily_sales','sales_detail','production_daily','purchases','inventory','utilities','labor'];
  for(const t of tables){
    const {data,error,count}=await client.from(t).select('*',{count:'exact',head:true});
    if(error) console.log(`${t}: ERROR - ${error.message}`);
    else console.log(`${t}: ${count} rows`);
  }

  // purchases 샘플
  const {data:pSample,error:pErr}=await client.from('purchases').select('*').limit(3);
  console.log('\npurchases sample:', pErr ? pErr.message : JSON.stringify(pSample,null,2));

  // sales_detail 샘플
  const {data:sdSample,error:sdErr}=await client.from('sales_detail').select('*').limit(3);
  console.log('\nsales_detail sample:', sdErr ? sdErr.message : JSON.stringify(sdSample,null,2));

  // daily_sales 날짜 범위
  const {data:ds1}=await client.from('daily_sales').select('date').order('date',{ascending:true}).limit(1);
  const {data:ds2}=await client.from('daily_sales').select('date').order('date',{ascending:false}).limit(1);
  console.log('\ndaily_sales date range:', ds1?.[0]?.date, '~', ds2?.[0]?.date);

  // production 날짜 범위
  const {data:p1}=await client.from('production_daily').select('date').order('date',{ascending:true}).limit(1);
  const {data:p2}=await client.from('production_daily').select('date').order('date',{ascending:false}).limit(1);
  console.log('production date range:', p1?.[0]?.date, '~', p2?.[0]?.date);
}
main().catch(e=>console.error(e));
