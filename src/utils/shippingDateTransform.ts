import type { DailySalesData, PurchaseData } from '../services/googleSheetService';

/** YYYY-MM-DD 문자열을 +1일 이동 */
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 생산일 기준 daily_sales → 출고일 기준으로 변환
 *
 * - 자사몰: 당일생산 당일출고 (D)
 * - 쿠팡/컬리: 생산 다음날 출고 (D+1)
 * - 생산량/생산매출/제품수량은 생산일(D)에 유지
 */
export function toShippingDateBasis(dailySales: DailySalesData[]): DailySalesData[] {
  const map = new Map<string, DailySalesData>();

  const empty = (date: string): DailySalesData => ({
    date,
    jasaPrice: 0,
    coupangPrice: 0,
    kurlyPrice: 0,
    totalRevenue: 0,
    frozenSoup: 0,
    etc: 0,
    bibimbap: 0,
    jasaHalf: 0,
    coupangHalf: 0,
    kurlyHalf: 0,
    frozenHalf: 0,
    etcHalf: 0,
    productionQty: 0,
    productionRevenue: 0,
  });

  for (const row of dailySales) {
    const d = row.date;       // 생산일
    const d1 = nextDay(d);    // 출고일 (D+1)

    // 생산일(D) 슬롯 확보
    if (!map.has(d)) map.set(d, empty(d));
    // 출고일(D+1) 슬롯 확보
    if (!map.has(d1)) map.set(d1, empty(d1));

    const slotD = map.get(d)!;
    const slotD1 = map.get(d1)!;

    // 자사몰 → 당일 출고 (D)
    slotD.jasaPrice += row.jasaPrice;
    slotD.jasaHalf += row.jasaHalf;

    // 쿠팡/컬리 → 다음날 출고 (D+1)
    slotD1.coupangPrice += row.coupangPrice;
    slotD1.coupangHalf += row.coupangHalf;
    slotD1.kurlyPrice += row.kurlyPrice;
    slotD1.kurlyHalf += row.kurlyHalf;

    // 생산 관련 수량은 생산일(D)에 유지
    slotD.productionQty += row.productionQty;
    slotD.productionRevenue += row.productionRevenue;
    slotD.frozenSoup += row.frozenSoup;
    slotD.etc += row.etc;
    slotD.bibimbap += row.bibimbap;
    slotD.frozenHalf += row.frozenHalf;
    slotD.etcHalf += row.etcHalf;
  }

  // totalRevenue 재계산 + date 정렬
  const result = Array.from(map.values());
  for (const row of result) {
    row.totalRevenue = row.jasaPrice + row.coupangPrice + row.kurlyPrice;
  }
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

/**
 * 구매 데이터를 출고일 기준으로 +1일 shift
 * (매입은 생산일 기준 → 출고 기준 매출과 정렬하기 위해)
 */
export function toShippingDatePurchases(purchases: PurchaseData[]): PurchaseData[] {
  return purchases.map(p => ({ ...p, date: nextDay(p.date) }));
}
