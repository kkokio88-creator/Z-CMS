/**
 * Statistical Ordering Service (통계적 발주 자동화 서비스)
 *
 * MRP(자재 소요량 계획)와 SPC(통계적 공정 관리) 기법 적용
 *
 * 핵심 로직:
 * 1. 미래 식단 계획 로드 (D+리드타임)
 * 2. 요일별 판매 통계로 수요 예측
 * 3. BOM 전개 → 식자재 소요량
 * 4. 안전재고 = Z × σ × √L
 * 5. 순소요량 = (총소요량 + 안전재고) - (현재고 + 미입고)
 * 6. MOQ/포장단위 보정
 */

import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// ========================================
// 타입 정의
// ========================================

export interface MealPlanItem {
  date: string;
  dayOfWeek: string;
  mealType: string;
  corner: string;
  menuCode: string;
  menuName: string;
  plannedQty?: number;
}

export interface SalesHistoryItem {
  date: string;
  dayOfWeek: string;
  menuCode: string;
  menuName: string;
  corner: string;
  soldQty: number;
}

export interface MenuRecipe {
  menuCode: string;
  menuName: string;
  ingredientCode: string;
  ingredientName: string;
  requiredQty: number;
  unit: string;
  lossRate: number;
}

export interface IngredientMaster {
  ingredientCode: string;
  ingredientName: string;
  category: string;
  unit: string;
  moq: number;
  packagingUnit: number;
  leadTime: number;
  safetyDays: number;
  supplierCode?: string;
  supplierName?: string;
  unitPrice: number;
}

export interface DayOfWeekStats {
  dayOfWeek: string;
  menuCode: string;
  menuName: string;
  avgSales: number;
  stdDev: number;
  maxSales: number;
  minSales: number;
  sampleCount: number;
}

export interface OrderCalculation {
  ingredientCode: string;
  ingredientName: string;
  category: string;
  unit: string;
  grossRequirement: number;
  safetyStock: number;
  totalRequirement: number;
  currentStock: number;
  inTransit: number;
  availableStock: number;
  netRequirement: number;
  orderQty: number;
  leadTime: number;
  moq: number;
  unitPrice: number;
  estimatedCost: number;
  avgDailySales: number;
  stdDev: number;
  serviceLevel: number;
  status: 'normal' | 'urgent' | 'shortage' | 'overstock';
  statusMessage?: string;
}

export interface OrderRecommendation {
  orderDate: string;
  deliveryDate: string;
  targetPeriodStart: string;
  targetPeriodEnd: string;
  items: OrderCalculation[];
  totalItems: number;
  urgentItems: number;
  shortageItems: number;
  totalEstimatedCost: number;
  serviceLevel: number;
  forecastWeeks: number;
  leadTimeDays: number;
}

export interface OrderingConfig {
  serviceLevel: number;
  zScore: number;
  forecastWeeks: number;
  defaultLeadTime: number;
  safetyDays: number;
  mealPlanSpreadsheetId: string;
}

// Z-Score 테이블 (서비스 수준별)
const Z_SCORE_TABLE: Record<number, number> = {
  90: 1.28,
  95: 1.65,
  97: 1.88,
  99: 2.33,
};

// ========================================
// 서비스 클래스
// ========================================

export class StatisticalOrderingService {
  private sheets: sheets_v4.Sheets | null = null;
  private config: OrderingConfig;

  constructor(config?: Partial<OrderingConfig>) {
    this.config = {
      serviceLevel: 95,
      zScore: Z_SCORE_TABLE[95],
      forecastWeeks: 4,
      defaultLeadTime: 2,
      safetyDays: 1,
      mealPlanSpreadsheetId:
        process.env.MEAL_PLAN_SPREADSHEET_ID || '1395EnPHzgOKCZ-kgSYzjNr84_QHPqIkQI8L9IBQUgWE',
      ...config,
    };
  }

  // ----------------------------------------
  // Google Sheets 연결
  // ----------------------------------------

  private async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;

    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    if (serviceAccountPath) {
      try {
        const keyFilePath = path.resolve(serviceAccountPath);
        if (fs.existsSync(keyFilePath)) {
          const keyFileContent = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));
          const auth = new google.auth.GoogleAuth({
            credentials: keyFileContent,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });

          const authClient = await auth.getClient();
          this.sheets = google.sheets({
            version: 'v4',
            auth: authClient as any,
          });
          return this.sheets;
        }
      } catch (error: any) {
        console.error('Error loading service account:', error.message);
      }
    }

    throw new Error('Google Sheets credentials not configured');
  }

  private async fetchSheetData(
    spreadsheetId: string,
    sheetName: string
  ): Promise<Record<string, any>[]> {
    try {
      const client = await this.getClient();
      const response = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];

      const headers = rows[0] as string[];
      return rows.slice(1).map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          const value = row[idx] || '';
          const numValue = parseFloat(value.toString().replace(/,/g, ''));
          obj[header] = isNaN(numValue) ? value : numValue;
        });
        return obj;
      });
    } catch (error: any) {
      console.error(`Error fetching sheet ${sheetName}:`, error.message);
      return [];
    }
  }

  // ----------------------------------------
  // Step 1: 미래 식단 계획 로드
  // ----------------------------------------

  async fetchMealPlan(startDate: string, endDate: string): Promise<MealPlanItem[]> {
    console.log(`[StatisticalOrdering] 식단 계획 조회: ${startDate} ~ ${endDate}`);

    const rawData = await this.fetchSheetData(this.config.mealPlanSpreadsheetId, '식단_히스토리');

    const mealPlan: MealPlanItem[] = rawData
      .filter(row => {
        const date = this.parseDate(row['일자'] || row['날짜'] || row['date']);
        return date && date >= startDate && date <= endDate;
      })
      .map(row => ({
        date: this.parseDate(row['일자'] || row['날짜'] || row['date']) || '',
        dayOfWeek: row['요일'] || this.getDayOfWeek(row['일자'] || row['날짜']),
        mealType: row['식사'] || row['식사구분'] || '중식',
        corner: row['코너'] || row['코너명'] || 'A코너',
        menuCode: String(row['메뉴코드'] || row['품목코드'] || ''),
        menuName: row['메뉴'] || row['메뉴명'] || row['품목명'] || '',
        plannedQty: row['계획수량'] || row['예상식수'],
      }));

    console.log(`[StatisticalOrdering] 식단 ${mealPlan.length}건 조회됨`);
    return mealPlan;
  }

  // ----------------------------------------
  // Step 2: 요일별 판매 통계 계산
  // ----------------------------------------

  async fetchSalesHistory(weeks: number = 4): Promise<SalesHistoryItem[]> {
    console.log(`[StatisticalOrdering] 최근 ${weeks}주 판매 실적 조회`);

    // 과거 N주 기간 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    const startStr = this.formatDate(startDate);
    const endStr = this.formatDate(endDate);

    const rawData = await this.fetchSheetData(this.config.mealPlanSpreadsheetId, '판매실적');

    if (rawData.length === 0) {
      // 판매실적 시트가 없으면 식단_히스토리에서 실적 컬럼 찾기
      const historyData = await this.fetchSheetData(
        this.config.mealPlanSpreadsheetId,
        '식단_히스토리'
      );
      return historyData
        .filter(row => {
          const date = this.parseDate(row['일자'] || row['날짜']);
          return date && date >= startStr && date <= endStr && row['판매수량'];
        })
        .map(row => ({
          date: this.parseDate(row['일자'] || row['날짜']) || '',
          dayOfWeek: row['요일'] || this.getDayOfWeek(row['일자'] || row['날짜']),
          menuCode: String(row['메뉴코드'] || row['품목코드'] || ''),
          menuName: row['메뉴'] || row['메뉴명'] || '',
          corner: row['코너'] || 'A코너',
          soldQty: Number(row['판매수량'] || row['실판매'] || 0),
        }));
    }

    return rawData
      .filter(row => {
        const date = this.parseDate(row['일자'] || row['날짜']);
        return date && date >= startStr && date <= endStr;
      })
      .map(row => ({
        date: this.parseDate(row['일자'] || row['날짜']) || '',
        dayOfWeek: row['요일'] || this.getDayOfWeek(row['일자']),
        menuCode: String(row['메뉴코드'] || row['품목코드'] || ''),
        menuName: row['메뉴'] || row['메뉴명'] || '',
        corner: row['코너'] || 'A코너',
        soldQty: Number(row['판매수량'] || row['판매량'] || 0),
      }));
  }

  calculateDayOfWeekStats(salesHistory: SalesHistoryItem[]): Map<string, DayOfWeekStats> {
    const statsMap = new Map<string, DayOfWeekStats>();

    // 메뉴+요일별 그룹화
    const grouped = new Map<string, number[]>();
    salesHistory.forEach(item => {
      const key = `${item.menuCode || item.menuName}_${item.dayOfWeek}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item.soldQty);
    });

    // 통계 계산
    grouped.forEach((sales, key) => {
      const [menuPart, dayOfWeek] = key.split('_');
      const menuCode = menuPart;
      const menuName =
        salesHistory.find(s => (s.menuCode || s.menuName) === menuCode)?.menuName || menuCode;

      const n = sales.length;
      const avg = sales.reduce((a, b) => a + b, 0) / n;
      const variance = sales.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      statsMap.set(key, {
        dayOfWeek,
        menuCode,
        menuName,
        avgSales: Math.round(avg * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
        maxSales: Math.max(...sales),
        minSales: Math.min(...sales),
        sampleCount: n,
      });
    });

    console.log(`[StatisticalOrdering] ${statsMap.size}개 메뉴-요일 통계 계산 완료`);
    return statsMap;
  }

  // ----------------------------------------
  // Step 3: BOM 전개 (메뉴 → 식자재)
  // ----------------------------------------

  async fetchMenuRecipes(): Promise<MenuRecipe[]> {
    console.log(`[StatisticalOrdering] 레시피(BOM) 데이터 조회`);

    // 레시피 시트 찾기
    const possibleSheets = ['레시피', 'BOM', '메뉴_BOM', '자재명세서'];
    let recipes: MenuRecipe[] = [];

    for (const sheetName of possibleSheets) {
      const rawData = await this.fetchSheetData(this.config.mealPlanSpreadsheetId, sheetName);
      if (rawData.length > 0) {
        recipes = rawData.map(row => ({
          menuCode: String(row['메뉴코드'] || row['완제품코드'] || row['상위품목'] || ''),
          menuName: row['메뉴명'] || row['완제품명'] || row['상위품명'] || '',
          ingredientCode: String(row['식자재코드'] || row['원자재코드'] || row['하위품목'] || ''),
          ingredientName: row['식자재명'] || row['원자재명'] || row['하위품명'] || '',
          requiredQty: Number(row['소요량'] || row['필요수량'] || row['수량'] || 0),
          unit: row['단위'] || 'g',
          lossRate: Number(row['로스율'] || row['손실율'] || 0),
        }));
        console.log(`[StatisticalOrdering] 레시피 ${recipes.length}건 조회됨 (시트: ${sheetName})`);
        break;
      }
    }

    return recipes;
  }

  async fetchIngredientMaster(): Promise<IngredientMaster[]> {
    console.log(`[StatisticalOrdering] 식자재 마스터 조회`);

    const possibleSheets = ['식자재_마스터', '품목마스터', '자재마스터', '원자재'];
    let ingredients: IngredientMaster[] = [];

    for (const sheetName of possibleSheets) {
      const rawData = await this.fetchSheetData(this.config.mealPlanSpreadsheetId, sheetName);
      if (rawData.length > 0) {
        ingredients = rawData.map(row => ({
          ingredientCode: String(row['품목코드'] || row['자재코드'] || row['코드'] || ''),
          ingredientName: row['품목명'] || row['자재명'] || row['이름'] || '',
          category: row['분류'] || row['카테고리'] || '기타',
          unit: row['단위'] || 'g',
          moq: Number(row['MOQ'] || row['최소발주량'] || 1),
          packagingUnit: Number(row['포장단위'] || row['구매단위'] || 1),
          leadTime: Number(row['리드타임'] || row['납기'] || this.config.defaultLeadTime),
          safetyDays: Number(row['안전재고일수'] || this.config.safetyDays),
          supplierCode: row['공급업체코드'],
          supplierName: row['공급업체'] || row['거래처'] || '',
          unitPrice: Number(row['단가'] || row['매입단가'] || 0),
        }));
        console.log(`[StatisticalOrdering] 식자재 마스터 ${ingredients.length}건 조회됨`);
        break;
      }
    }

    return ingredients;
  }

  // ----------------------------------------
  // Step 4: 재고/발주 현황 (ECOUNT 또는 시트)
  // ----------------------------------------

  async fetchCurrentInventory(): Promise<Map<string, number>> {
    console.log(`[StatisticalOrdering] 현재 재고 조회`);

    const inventory = new Map<string, number>();

    // 재고 시트에서 조회
    const possibleSheets = ['재고현황', '창고재고', '재고'];
    for (const sheetName of possibleSheets) {
      const rawData = await this.fetchSheetData(this.config.mealPlanSpreadsheetId, sheetName);
      if (rawData.length > 0) {
        rawData.forEach(row => {
          const code = String(row['품목코드'] || row['자재코드'] || '');
          const qty = Number(row['재고수량'] || row['현재고'] || row['수량'] || 0);
          if (code) {
            inventory.set(code, (inventory.get(code) || 0) + qty);
          }
        });
        break;
      }
    }

    console.log(`[StatisticalOrdering] ${inventory.size}개 품목 재고 조회됨`);
    return inventory;
  }

  async fetchInTransitOrders(): Promise<Map<string, number>> {
    console.log(`[StatisticalOrdering] 미입고 발주 조회`);

    const inTransit = new Map<string, number>();

    // 발주현황 시트에서 조회
    const possibleSheets = ['발주현황', '미입고발주', '발주'];
    for (const sheetName of possibleSheets) {
      const rawData = await this.fetchSheetData(this.config.mealPlanSpreadsheetId, sheetName);
      if (rawData.length > 0) {
        rawData.forEach(row => {
          // 미입고 건만 필터
          const status = row['상태'] || row['입고상태'] || '';
          if (status === '입고완료' || status === '완료') return;

          const code = String(row['품목코드'] || row['자재코드'] || '');
          const qty = Number(row['발주수량'] || row['수량'] || 0);
          const receivedQty = Number(row['입고수량'] || 0);
          const pendingQty = qty - receivedQty;

          if (code && pendingQty > 0) {
            inTransit.set(code, (inTransit.get(code) || 0) + pendingQty);
          }
        });
        break;
      }
    }

    console.log(`[StatisticalOrdering] ${inTransit.size}개 품목 미입고 조회됨`);
    return inTransit;
  }

  // ----------------------------------------
  // Step 5: 발주량 계산 (핵심 알고리즘)
  // ----------------------------------------

  calculateOrderRecommendation(
    mealPlan: MealPlanItem[],
    stats: Map<string, DayOfWeekStats>,
    recipes: MenuRecipe[],
    ingredients: IngredientMaster[],
    currentInventory: Map<string, number>,
    inTransit: Map<string, number>
  ): OrderRecommendation {
    console.log(`[StatisticalOrdering] 발주량 계산 시작`);

    const today = new Date();
    const orderDate = this.formatDate(today);

    // 리드타임 고려한 대상 기간
    const targetStart = new Date(today);
    targetStart.setDate(targetStart.getDate() + this.config.defaultLeadTime);
    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetEnd.getDate() + 7); // 7일분

    // 1. 메뉴별 예상 판매량 계산
    const menuDemand = new Map<string, { qty: number; stdDev: number }>();

    mealPlan.forEach(plan => {
      const key = `${plan.menuCode || plan.menuName}_${plan.dayOfWeek}`;
      const stat = stats.get(key);

      let forecastQty = plan.plannedQty || 100; // 기본값
      let stdDev = 20; // 기본 표준편차

      if (stat) {
        forecastQty = stat.avgSales;
        stdDev = stat.stdDev;
      }

      const menuKey = plan.menuCode || plan.menuName;
      const existing = menuDemand.get(menuKey) || { qty: 0, stdDev: 0 };
      menuDemand.set(menuKey, {
        qty: existing.qty + forecastQty,
        stdDev: Math.sqrt(existing.stdDev ** 2 + stdDev ** 2), // 분산 합
      });
    });

    // 2. BOM 전개 → 식자재별 소요량
    const ingredientRequirement = new Map<
      string,
      {
        grossQty: number;
        stdDev: number;
        menuSources: string[];
      }
    >();

    menuDemand.forEach((demand, menuKey) => {
      const menuRecipes = recipes.filter(r => r.menuCode === menuKey || r.menuName === menuKey);

      menuRecipes.forEach(recipe => {
        const ingredientKey = recipe.ingredientCode || recipe.ingredientName;
        const requiredQty = demand.qty * recipe.requiredQty * (1 + (recipe.lossRate || 0) / 100);
        const stdDevQty = demand.stdDev * recipe.requiredQty;

        const existing = ingredientRequirement.get(ingredientKey) || {
          grossQty: 0,
          stdDev: 0,
          menuSources: [],
        };

        ingredientRequirement.set(ingredientKey, {
          grossQty: existing.grossQty + requiredQty,
          stdDev: Math.sqrt(existing.stdDev ** 2 + stdDevQty ** 2),
          menuSources: [...existing.menuSources, menuKey],
        });
      });
    });

    // 3. 발주량 계산
    const ingredientMap = new Map(ingredients.map(i => [i.ingredientCode || i.ingredientName, i]));

    const orderItems: OrderCalculation[] = [];

    ingredientRequirement.forEach((req, ingredientKey) => {
      const master = ingredientMap.get(ingredientKey) || {
        ingredientCode: ingredientKey,
        ingredientName: ingredientKey,
        category: '기타',
        unit: 'g',
        moq: 1,
        packagingUnit: 1,
        leadTime: this.config.defaultLeadTime,
        safetyDays: this.config.safetyDays,
        unitPrice: 0,
      };

      // 안전재고 = Z × σ × √L
      const L = master.leadTime + master.safetyDays;
      const safetyStock = this.config.zScore * req.stdDev * Math.sqrt(L);

      // 총 필요량
      const totalRequirement = req.grossQty + safetyStock;

      // 가용 재고
      const currentStock = currentInventory.get(ingredientKey) || 0;
      const inTransitQty = inTransit.get(ingredientKey) || 0;
      const availableStock = currentStock + inTransitQty;

      // 순 소요량
      const netRequirement = Math.max(0, totalRequirement - availableStock);

      // MOQ 및 포장단위 보정
      let orderQty = 0;
      if (netRequirement > 0) {
        // MOQ 적용
        orderQty = Math.max(netRequirement, master.moq);
        // 포장단위 올림
        if (master.packagingUnit > 1) {
          orderQty = Math.ceil(orderQty / master.packagingUnit) * master.packagingUnit;
        }
      }

      // 상태 판단
      let status: OrderCalculation['status'] = 'normal';
      let statusMessage = '';

      const daysOfStock = req.grossQty > 0 ? availableStock / (req.grossQty / 7) : 999;

      if (daysOfStock < master.leadTime) {
        status = 'shortage';
        statusMessage = `재고 ${daysOfStock.toFixed(1)}일분 - 긴급발주 필요`;
      } else if (netRequirement > 0 && daysOfStock < master.leadTime + 2) {
        status = 'urgent';
        statusMessage = `재고 ${daysOfStock.toFixed(1)}일분 - 빠른 발주 권장`;
      } else if (availableStock > totalRequirement * 3) {
        status = 'overstock';
        statusMessage = `과재고 상태`;
      }

      orderItems.push({
        ingredientCode: master.ingredientCode,
        ingredientName: master.ingredientName,
        category: master.category,
        unit: master.unit,
        grossRequirement: Math.round(req.grossQty),
        safetyStock: Math.round(safetyStock),
        totalRequirement: Math.round(totalRequirement),
        currentStock: Math.round(currentStock),
        inTransit: Math.round(inTransitQty),
        availableStock: Math.round(availableStock),
        netRequirement: Math.round(netRequirement),
        orderQty: Math.round(orderQty),
        leadTime: master.leadTime,
        moq: master.moq,
        unitPrice: master.unitPrice,
        estimatedCost: Math.round(orderQty * master.unitPrice),
        avgDailySales: Math.round(req.grossQty / 7),
        stdDev: Math.round(req.stdDev),
        serviceLevel: this.config.serviceLevel,
        status,
        statusMessage,
      });
    });

    // 정렬: 긴급 → 부족 → 일반 → 과재고
    const statusOrder = { shortage: 0, urgent: 1, normal: 2, overstock: 3 };
    orderItems.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // 요약 통계
    const urgentItems = orderItems.filter(
      i => i.status === 'urgent' || i.status === 'shortage'
    ).length;
    const shortageItems = orderItems.filter(i => i.status === 'shortage').length;
    const totalEstimatedCost = orderItems.reduce((sum, i) => sum + i.estimatedCost, 0);

    const recommendation: OrderRecommendation = {
      orderDate,
      deliveryDate: this.formatDate(targetStart),
      targetPeriodStart: this.formatDate(targetStart),
      targetPeriodEnd: this.formatDate(targetEnd),
      items: orderItems,
      totalItems: orderItems.length,
      urgentItems,
      shortageItems,
      totalEstimatedCost,
      serviceLevel: this.config.serviceLevel,
      forecastWeeks: this.config.forecastWeeks,
      leadTimeDays: this.config.defaultLeadTime,
    };

    console.log(
      `[StatisticalOrdering] 발주 권고 ${orderItems.length}건 생성 (긴급: ${urgentItems}, 부족: ${shortageItems})`
    );
    return recommendation;
  }

  // ----------------------------------------
  // 메인 실행 함수
  // ----------------------------------------

  async generateOrderRecommendation(): Promise<OrderRecommendation> {
    console.log('[StatisticalOrdering] ===== 발주 권고 생성 시작 =====');

    // 대상 기간 (D+리드타임 ~ D+리드타임+7)
    const today = new Date();
    const targetStart = new Date(today);
    targetStart.setDate(targetStart.getDate() + this.config.defaultLeadTime);
    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetEnd.getDate() + 7);

    // 데이터 수집 (병렬)
    const [mealPlan, salesHistory, recipes, ingredients, currentInventory, inTransit] =
      await Promise.all([
        this.fetchMealPlan(this.formatDate(targetStart), this.formatDate(targetEnd)),
        this.fetchSalesHistory(this.config.forecastWeeks),
        this.fetchMenuRecipes(),
        this.fetchIngredientMaster(),
        this.fetchCurrentInventory(),
        this.fetchInTransitOrders(),
      ]);

    // 통계 계산
    const stats = this.calculateDayOfWeekStats(salesHistory);

    // 발주량 계산
    const recommendation = this.calculateOrderRecommendation(
      mealPlan,
      stats,
      recipes,
      ingredients,
      currentInventory,
      inTransit
    );

    console.log('[StatisticalOrdering] ===== 발주 권고 생성 완료 =====');
    return recommendation;
  }

  // ----------------------------------------
  // 유틸리티 함수
  // ----------------------------------------

  private parseDate(dateValue: any): string | null {
    if (!dateValue) return null;

    const str = String(dateValue);

    // YYYYMMDD 형식
    if (/^\d{8}$/.test(str)) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }

    // YYYY-MM-DD 또는 YYYY/MM/DD 형식
    const match = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }

    return null;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getDayOfWeek(dateValue: any): string {
    const dateStr = this.parseDate(dateValue);
    if (!dateStr) return '';

    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  }

  // 설정 업데이트
  updateConfig(newConfig: Partial<OrderingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.serviceLevel) {
      this.config.zScore = Z_SCORE_TABLE[newConfig.serviceLevel] || 1.65;
    }
  }

  getConfig(): OrderingConfig {
    return { ...this.config };
  }
}

// 싱글톤 인스턴스
export const statisticalOrderingService = new StatisticalOrderingService();
