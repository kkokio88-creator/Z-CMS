/**
 * Statistical Ordering Service (프론트엔드)
 * 통계적 발주 자동화 시스템 API 호출
 */

import {
    MealPlanItem,
    DayOfWeekStats,
    MenuRecipe,
    IngredientMaster,
    OrderCalculation,
    OrderRecommendation,
    OrderingConfig,
} from '../types';

const BACKEND_URL = 'http://localhost:3001/api';

/**
 * 발주 권고 생성
 */
export const fetchOrderRecommendation = async (): Promise<OrderRecommendation | null> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/recommendation`);
        const result = await response.json();

        if (!result.success) {
            console.error('Order recommendation failed:', result.error);
            return null;
        }

        return result.data as OrderRecommendation;
    } catch (e: any) {
        console.error('Order recommendation error:', e);
        return null;
    }
};

/**
 * 미래 식단 계획 조회
 */
export const fetchMealPlan = async (
    startDate?: string,
    endDate?: string
): Promise<MealPlanItem[]> => {
    try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await fetch(`${BACKEND_URL}/ordering/meal-plan?${params}`);
        const result = await response.json();

        return result.success ? result.data : [];
    } catch (e) {
        console.error('Meal plan fetch error:', e);
        return [];
    }
};

/**
 * 요일별 판매 통계 조회
 */
export const fetchSalesStats = async (
    weeks: number = 4
): Promise<DayOfWeekStats[]> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/sales-stats?weeks=${weeks}`);
        const result = await response.json();

        return result.success ? result.data : [];
    } catch (e) {
        console.error('Sales stats fetch error:', e);
        return [];
    }
};

/**
 * 레시피(BOM) 조회
 */
export const fetchRecipes = async (): Promise<MenuRecipe[]> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/recipes`);
        const result = await response.json();

        return result.success ? result.data : [];
    } catch (e) {
        console.error('Recipes fetch error:', e);
        return [];
    }
};

/**
 * 식자재 마스터 조회
 */
export const fetchIngredients = async (): Promise<IngredientMaster[]> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/ingredients`);
        const result = await response.json();

        return result.success ? result.data : [];
    } catch (e) {
        console.error('Ingredients fetch error:', e);
        return [];
    }
};

/**
 * 현재 재고 조회
 */
export const fetchInventory = async (): Promise<Record<string, number>> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/inventory`);
        const result = await response.json();

        return result.success ? result.data : {};
    } catch (e) {
        console.error('Inventory fetch error:', e);
        return {};
    }
};

/**
 * 미입고 발주 조회
 */
export const fetchInTransit = async (): Promise<Record<string, number>> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/in-transit`);
        const result = await response.json();

        return result.success ? result.data : {};
    } catch (e) {
        console.error('In-transit fetch error:', e);
        return {};
    }
};

/**
 * 발주 설정 조회
 */
export const fetchOrderingConfig = async (): Promise<OrderingConfig | null> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/config`);
        const result = await response.json();

        return result.success ? result.data : null;
    } catch (e) {
        console.error('Config fetch error:', e);
        return null;
    }
};

/**
 * 발주 설정 업데이트
 */
export const updateOrderingConfig = async (
    config: Partial<OrderingConfig>
): Promise<OrderingConfig | null> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        const result = await response.json();

        return result.success ? result.data : null;
    } catch (e) {
        console.error('Config update error:', e);
        return null;
    }
};

/**
 * 발주 시뮬레이션
 */
export const simulateOrder = async (params: {
    serviceLevel?: number;
    forecastWeeks?: number;
    additionalDemand?: Record<string, number>;
}): Promise<OrderRecommendation | null> => {
    try {
        const response = await fetch(`${BACKEND_URL}/ordering/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        const result = await response.json();

        return result.success ? result.data : null;
    } catch (e) {
        console.error('Simulation error:', e);
        return null;
    }
};

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 상태별 색상 클래스 반환
 */
export const getStatusColorClass = (status: OrderCalculation['status']): string => {
    switch (status) {
        case 'shortage':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'urgent':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        case 'overstock':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        default:
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
};

/**
 * 상태 아이콘 반환
 */
export const getStatusIcon = (status: OrderCalculation['status']): string => {
    switch (status) {
        case 'shortage': return 'error';
        case 'urgent': return 'warning';
        case 'overstock': return 'inventory_2';
        default: return 'check_circle';
    }
};

/**
 * 상태 레이블 반환
 */
export const getStatusLabel = (status: OrderCalculation['status']): string => {
    switch (status) {
        case 'shortage': return '재고부족';
        case 'urgent': return '긴급발주';
        case 'overstock': return '과재고';
        default: return '정상';
    }
};

/**
 * 숫자를 통화 형식으로 포맷
 */
export const formatCurrency = (value: number): string => {
    return value.toLocaleString('ko-KR');
};

/**
 * 재고일수 계산
 */
export const calculateStockDays = (
    availableStock: number,
    dailyConsumption: number
): number => {
    if (dailyConsumption <= 0) return 999;
    return Math.round((availableStock / dailyConsumption) * 10) / 10;
};

/**
 * 서비스 수준별 Z-Score 반환
 */
export const getZScore = (serviceLevel: number): number => {
    const zScoreTable: Record<number, number> = {
        90: 1.28,
        95: 1.65,
        97: 1.88,
        99: 2.33,
    };
    return zScoreTable[serviceLevel] || 1.65;
};

/**
 * 카테고리별 그룹화
 */
export const groupByCategory = (
    items: OrderCalculation[]
): Map<string, OrderCalculation[]> => {
    const grouped = new Map<string, OrderCalculation[]>();

    items.forEach(item => {
        const category = item.category || '기타';
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push(item);
    });

    return grouped;
};

/**
 * 요일별 그룹화 (식단)
 */
export const groupMealsByDay = (
    meals: MealPlanItem[]
): Map<string, MealPlanItem[]> => {
    const grouped = new Map<string, MealPlanItem[]>();

    meals.forEach(meal => {
        if (!grouped.has(meal.date)) {
            grouped.set(meal.date, []);
        }
        grouped.get(meal.date)!.push(meal);
    });

    return grouped;
};

/**
 * CSV 내보내기
 */
export const exportToCSV = (
    recommendation: OrderRecommendation,
    filename?: string
): void => {
    const headers = [
        '품목코드', '품목명', '분류', '단위',
        '총소요량', '안전재고', '현재고', '입고예정', '순소요량', '발주수량',
        '단가', '예상금액', '리드타임', 'MOQ', '상태'
    ];

    const rows = recommendation.items.map(item => [
        item.ingredientCode,
        item.ingredientName,
        item.category,
        item.unit,
        item.grossRequirement,
        item.safetyStock,
        item.currentStock,
        item.inTransit,
        item.netRequirement,
        item.orderQty,
        item.unitPrice,
        item.estimatedCost,
        item.leadTime,
        item.moq,
        getStatusLabel(item.status),
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `발주권고_${recommendation.orderDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
