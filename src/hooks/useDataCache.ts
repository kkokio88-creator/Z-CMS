const CACHE_KEY = 'ZCMS_DATA_CACHE';
const CACHE_TTL = 30 * 60 * 1000; // 30분

export function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return cached;
  } catch { return null; }
}

export function saveCache(gsResult: any) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      dailySales: gsResult.dailySales,
      salesDetail: gsResult.salesDetail,
      production: gsResult.production,
      purchases: gsResult.purchases,
      utilities: gsResult.utilities,
      labor: gsResult.labor || [],
      bom: gsResult.bom || [],
      materialMaster: gsResult.materialMaster || [],
      profitTrend: gsResult.profitTrend,
    }));
  } catch { /* sessionStorage full — ignore */ }
}
