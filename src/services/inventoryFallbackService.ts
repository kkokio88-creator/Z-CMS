import type { InventorySafetyItem, StocktakeAnomalyItem, OrderSuggestion } from '../types';
import type { PurchaseData } from './googleSheetService';

function deterministicRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash % 100) / 100; // Returns 0-1
}

export function generateInventoryFromPurchases(purchases: PurchaseData[]): {
  inventory: InventorySafetyItem[];
  suggestions: OrderSuggestion[];
  anomalies: StocktakeAnomalyItem[];
} {
  // 품목별 구매 데이터 집계
  const purchasesByProduct = new Map<
    string,
    { name: string; qty: number; cost: number; lastDate: string }
  >();
  purchases.forEach(p => {
    const existing = purchasesByProduct.get(p.productCode) || {
      name: p.productName,
      qty: 0,
      cost: 0,
      lastDate: '',
    };
    existing.qty += p.quantity;
    existing.cost += p.total;
    if (p.date > existing.lastDate) existing.lastDate = p.date;
    purchasesByProduct.set(p.productCode, existing);
  });

  // 재고 데이터로 변환 (InventorySafetyItem 타입에 맞춤)
  const inventory: InventorySafetyItem[] = Array.from(
    purchasesByProduct.entries()
  )
    .slice(0, 50)
    .map(([_code, data], idx) => {
      const avgDailyUsage = data.qty / 30;
      const safetyStock = Math.ceil(avgDailyUsage * 7);
      const currentStock = Math.ceil(data.qty * 0.3);
      const turnoverRate =
        avgDailyUsage > 0 ? Math.round((currentStock / avgDailyUsage) * 10) / 10 : 0;
      const statusValue: 'Normal' | 'Overstock' | 'Shortage' =
        currentStock < safetyStock
          ? 'Shortage'
          : currentStock > safetyStock * 3
            ? 'Overstock'
            : 'Normal';

      return {
        id: `inv-${idx}`,
        skuName: data.name,
        currentStock,
        safetyStock,
        status: statusValue,
        turnoverRate,
        warehouse: '본사창고',
        category: '원자재',
      };
    });

  // 발주 제안 생성 (OrderSuggestion 타입에 맞춤)
  const suggestions: OrderSuggestion[] = inventory
    .filter(inv => inv.status === 'Shortage')
    .slice(0, 20)
    .map((inv, idx) => {
      const avgDaily = inv.turnoverRate > 0 ? inv.currentStock / inv.turnoverRate : 10;
      const suggestedQty = Math.max(inv.safetyStock * 2 - inv.currentStock, 0);
      const unitPrice = 5000;
      return {
        id: `sug-${idx}`,
        skuCode: `SKU-${idx}`,
        skuName: inv.skuName,
        supplierId: `SUP-${idx % 5}`,
        supplierName: '주거래처',
        currentStock: inv.currentStock,
        safetyStock: inv.safetyStock,
        avgDailyConsumption: Math.round(avgDaily),
        leadTime: 3,
        suggestedQty,
        orderQty: suggestedQty,
        unit: 'EA',
        unitPrice,
        status: 'Ready' as const,
        method: 'Email' as const,
      };
    });

  // 재고 실사 이상 징후 생성 (StocktakeAnomalyItem 타입에 맞춤)
  const anomalies: StocktakeAnomalyItem[] = inventory
    .filter(inv => inv.status !== 'Normal')
    .slice(0, 20)
    .map((inv, idx) => {
      const variance = Math.floor(deterministicRandom(`anomaly-${idx}-${inv.skuName}`) * 10) - 5;
      return {
        id: `ano-${idx}`,
        materialName: inv.skuName,
        location: inv.warehouse,
        systemQty: inv.currentStock + variance,
        countedQty: inv.currentStock,
        aiExpectedQty: inv.currentStock + Math.floor(variance / 2),
        anomalyScore: Math.round(50 + deterministicRandom(`score-${idx}-${inv.skuName}`) * 40),
        reason: inv.status === 'Shortage' ? '입고 누락 가능성' : '과잉 재고 의심',
      };
    });

  return { inventory, suggestions, anomalies };
}
