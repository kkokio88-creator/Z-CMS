const files = {
  'daily-sales': './tmp_ds.json',
  'sales-detail': './tmp_sd.json',
  'production': './tmp_prod.json',
  'purchases': './tmp_purchases.json',
  'utilities': './tmp_util.json',
};

for (const [name, file] of Object.entries(files)) {
  const d = require(file);
  const data = d.data || [];
  const dates = data.map(r => r.date).filter(Boolean).sort();

  // Check duplicates by all fields except id and synced_at
  const counts = {};
  data.forEach(r => {
    const entries = Object.entries(r)
      .filter(([k]) => k !== 'id' && k !== 'synced_at')
      .sort(([a], [b]) => a.localeCompare(b));
    const k = JSON.stringify(entries);
    counts[k] = (counts[k] || 0) + 1;
  });
  const dupeGroups = Object.values(counts).filter(c => c > 1);
  const dupeRecords = dupeGroups.reduce((s, c) => s + c - 1, 0);
  const uniqueCount = Object.keys(counts).length;

  console.log(`${name}: total=${data.length} unique=${uniqueCount} dupes=${dupeRecords} dates=${dates[0] || ''}~${dates[dates.length - 1] || ''}`);

  if (name === 'purchases') {
    const total = data.reduce((s, r) => s + (r.total || 0), 0);
    const uniqueTotal = total * uniqueCount / data.length;
    console.log(`  raw total: ${total.toLocaleString()} estimated unique total: ${Math.round(uniqueTotal).toLocaleString()}`);
  }
  if (name === 'daily-sales') {
    const totalRev = data.reduce((s, r) => s + (r.total_revenue || 0), 0);
    const uniqueRev = totalRev * uniqueCount / data.length;
    console.log(`  raw total_revenue: ${totalRev.toLocaleString()} estimated unique: ${Math.round(uniqueRev).toLocaleString()}`);
  }
}
