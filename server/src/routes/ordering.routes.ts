/**
 * 통계적 발주 API 라우트
 */

import { Router, Request, Response } from 'express';
import { statisticalOrderingService } from '../services/StatisticalOrderingService.js';

const router = Router();

/**
 * GET /api/ordering/recommendation
 * 발주 권고 생성
 */
router.get('/recommendation', async (_req: Request, res: Response) => {
    try {
        console.log('[Ordering API] 발주 권고 요청');
        const recommendation = await statisticalOrderingService.generateOrderRecommendation();

        res.json({
            success: true,
            data: recommendation,
        });
    } catch (error: any) {
        console.error('[Ordering API] 발주 권고 생성 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ordering/meal-plan
 * 미래 식단 계획 조회
 */
router.get('/meal-plan', async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        // 기본값: 오늘부터 7일
        const today = new Date();
        const defaultStart = today.toISOString().slice(0, 10);
        const defaultEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const mealPlan = await statisticalOrderingService.fetchMealPlan(
            (startDate as string) || defaultStart,
            (endDate as string) || defaultEnd
        );

        res.json({
            success: true,
            data: mealPlan,
            period: {
                start: startDate || defaultStart,
                end: endDate || defaultEnd,
            },
        });
    } catch (error: any) {
        console.error('[Ordering API] 식단 계획 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ordering/sales-stats
 * 요일별 판매 통계
 */
router.get('/sales-stats', async (req: Request, res: Response) => {
    try {
        const { weeks } = req.query;
        const forecastWeeks = parseInt(weeks as string) || 4;

        const salesHistory = await statisticalOrderingService.fetchSalesHistory(forecastWeeks);
        const stats = statisticalOrderingService.calculateDayOfWeekStats(salesHistory);

        // Map을 배열로 변환
        const statsArray = Array.from(stats.values());

        res.json({
            success: true,
            data: statsArray,
            config: {
                forecastWeeks,
                samplePeriod: `최근 ${forecastWeeks}주`,
            },
        });
    } catch (error: any) {
        console.error('[Ordering API] 판매 통계 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ordering/recipes
 * 레시피(BOM) 조회
 */
router.get('/recipes', async (_req: Request, res: Response) => {
    try {
        const recipes = await statisticalOrderingService.fetchMenuRecipes();

        res.json({
            success: true,
            data: recipes,
            count: recipes.length,
        });
    } catch (error: any) {
        console.error('[Ordering API] 레시피 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ordering/ingredients
 * 식자재 마스터 조회
 */
router.get('/ingredients', async (_req: Request, res: Response) => {
    try {
        const ingredients = await statisticalOrderingService.fetchIngredientMaster();

        res.json({
            success: true,
            data: ingredients,
            count: ingredients.length,
        });
    } catch (error: any) {
        console.error('[Ordering API] 식자재 마스터 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ordering/inventory
 * 현재 재고 조회
 */
router.get('/inventory', async (_req: Request, res: Response) => {
    try {
        const inventory = await statisticalOrderingService.fetchCurrentInventory();

        // Map을 객체로 변환
        const inventoryObj: Record<string, number> = {};
        inventory.forEach((qty, code) => {
            inventoryObj[code] = qty;
        });

        res.json({
            success: true,
            data: inventoryObj,
            itemCount: inventory.size,
        });
    } catch (error: any) {
        console.error('[Ordering API] 재고 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ordering/in-transit
 * 미입고 발주 조회
 */
router.get('/in-transit', async (_req: Request, res: Response) => {
    try {
        const inTransit = await statisticalOrderingService.fetchInTransitOrders();

        // Map을 객체로 변환
        const inTransitObj: Record<string, number> = {};
        inTransit.forEach((qty, code) => {
            inTransitObj[code] = qty;
        });

        res.json({
            success: true,
            data: inTransitObj,
            itemCount: inTransit.size,
        });
    } catch (error: any) {
        console.error('[Ordering API] 미입고 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ordering/config
 * 설정 조회
 */
router.get('/config', (_req: Request, res: Response) => {
    try {
        const config = statisticalOrderingService.getConfig();

        res.json({
            success: true,
            data: config,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * PUT /api/ordering/config
 * 설정 업데이트
 */
router.put('/config', (req: Request, res: Response) => {
    try {
        const newConfig = req.body;

        statisticalOrderingService.updateConfig(newConfig);
        const updatedConfig = statisticalOrderingService.getConfig();

        res.json({
            success: true,
            data: updatedConfig,
            message: '설정이 업데이트되었습니다.',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/ordering/simulate
 * 발주 시뮬레이션 (what-if 분석)
 */
router.post('/simulate', async (req: Request, res: Response) => {
    try {
        const { serviceLevel, forecastWeeks, additionalDemand } = req.body;

        // 임시로 설정 변경
        const originalConfig = statisticalOrderingService.getConfig();

        if (serviceLevel) {
            statisticalOrderingService.updateConfig({ serviceLevel });
        }
        if (forecastWeeks) {
            statisticalOrderingService.updateConfig({ forecastWeeks });
        }

        // 발주 권고 생성
        const recommendation = await statisticalOrderingService.generateOrderRecommendation();

        // 추가 수요 반영 (옵션)
        if (additionalDemand && typeof additionalDemand === 'object') {
            recommendation.items.forEach(item => {
                const additional = additionalDemand[item.ingredientCode] || 0;
                if (additional > 0) {
                    item.grossRequirement += additional;
                    item.totalRequirement += additional;
                    item.netRequirement = Math.max(0, item.totalRequirement - item.availableStock);

                    // MOQ 재적용
                    if (item.netRequirement > 0) {
                        item.orderQty = Math.max(item.netRequirement, item.moq);
                    }
                    item.estimatedCost = item.orderQty * item.unitPrice;
                }
            });

            // 총액 재계산
            recommendation.totalEstimatedCost = recommendation.items.reduce(
                (sum, i) => sum + i.estimatedCost, 0
            );
        }

        // 원래 설정으로 복원
        statisticalOrderingService.updateConfig(originalConfig);

        res.json({
            success: true,
            data: recommendation,
            simulationParams: {
                serviceLevel: serviceLevel || originalConfig.serviceLevel,
                forecastWeeks: forecastWeeks || originalConfig.forecastWeeks,
                additionalDemand,
            },
        });
    } catch (error: any) {
        console.error('[Ordering API] 시뮬레이션 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
