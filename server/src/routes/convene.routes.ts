/**
 * 에이전트 회의 소집 라우트
 * 원가 분석 / 대시보드 기획 회의 소집
 */

import { Router, Request, Response } from 'express';
import type { ChiefOrchestrator } from '../agents/orchestrator/ChiefOrchestrator.js';

export function createConveneRoutes(
  chiefOrchestrator: ChiefOrchestrator,
  multiSpreadsheetAdapter: { fetchAllCostAnalysisData: () => Promise<any> }
): Router {
  const router = Router();

  // 원가 분석 에이전트 회의 소집
  router.post('/cost-analysis/convene', async (_req: Request, res: Response) => {
    try {
      console.log('[CostAnalysis] 데이터 가져오는 중...');
      const costData = await multiSpreadsheetAdapter.fetchAllCostAnalysisData();

      const dataSummary = {
        period: {
          sales:
            costData.sales.length > 0
              ? `${costData.sales[0]?.date || 'N/A'} ~ ${costData.sales[costData.sales.length - 1]?.date || 'N/A'}`
              : '데이터 없음',
          purchases:
            costData.purchases.length > 0
              ? `${costData.purchases[0]?.date || 'N/A'} ~ ${costData.purchases[costData.purchases.length - 1]?.date || 'N/A'}`
              : '데이터 없음',
        },
        counts: {
          sales: costData.sales.length,
          purchases: costData.purchases.length,
          bomItems: costData.bom.length,
        },
        topItems: {
          sales: [...new Set(costData.sales.map((s: any) => s.itemName))].slice(0, 10),
          purchases: [...new Set(costData.purchases.map((p: any) => p.itemName))].slice(0, 10),
          bom: costData.bom.map((b: any) => b.parentItemName).slice(0, 10),
        },
      };

      console.log('[CostAnalysis] 데이터 요약:', JSON.stringify(dataSummary, null, 2));

      const debateId = await chiefOrchestrator.orchestrateDebate({
        team: 'cost-management-team',
        topic: '원가 구조 분석 및 최적화 방안',
        contextData: {
          dataSummary,
          rawDataAvailable: true,
          analysisType: 'comprehensive-cost-review',
          fetchedAt: costData.fetchedAt,
        },
        priority: 'high',
      });

      const bomDebateId = await chiefOrchestrator.orchestrateDebate({
        team: 'bom-waste-team',
        topic: 'BOM 기반 원가 분석',
        contextData: {
          bomItems: dataSummary.topItems.bom,
          bomCount: dataSummary.counts.bomItems,
          purchaseItems: dataSummary.topItems.purchases,
        },
        priority: 'high',
      });

      res.json({
        success: true,
        message: '원가 분석 에이전트 회의 소집 완료',
        dataSummary,
        debates: { costDebateId: debateId, bomDebateId },
      });
    } catch (error: unknown) {
      console.error('[CostAnalysis] 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // 대시보드 기획 회의 소집
  router.post('/dashboard-planning/convene', async (_req: Request, res: Response) => {
    try {
      console.log('[DashboardPlanning] 데이터 가져오는 중...');
      const costData = await multiSpreadsheetAdapter.fetchAllCostAnalysisData();

      const dataStructure = {
        sales: {
          count: costData.sales.length,
          fields: costData.sales.length > 0 ? Object.keys(costData.sales[0]) : [],
          sampleItems: costData.sales.slice(0, 5).map((s: any) => s.itemName),
          uniqueItems: [...new Set(costData.sales.map((s: any) => s.itemName))].length,
          totalAmount: costData.sales.reduce((sum: number, s: any) => sum + s.amount, 0),
        },
        purchases: {
          count: costData.purchases.length,
          fields: costData.purchases.length > 0 ? Object.keys(costData.purchases[0]) : [],
          sampleItems: costData.purchases.slice(0, 5).map((p: any) => p.itemName),
          uniqueItems: [...new Set(costData.purchases.map((p: any) => p.itemName))].length,
          totalAmount: costData.purchases.reduce((sum: number, p: any) => sum + p.amount, 0),
        },
        bom: {
          count: costData.bom.length,
          fields: costData.bom.length > 0 ? Object.keys(costData.bom[0]) : [],
          sampleParents: [...new Set(costData.bom.map((b: any) => b.parentItemName))].slice(0, 5),
        },
      };

      const analysisOpportunities = {
        costAnalysis: [
          '품목별 매입단가 추이 분석',
          '판매금액 대비 원가율 계산',
          'BOM 기반 제품별 원가 산출',
          '공급업체별 매입 비교',
        ],
        profitAnalysis: [
          '품목별 마진율 분석',
          '고마진/저마진 품목 식별',
          '판매량 vs 수익성 매트릭스',
        ],
        efficiencyAnalysis: ['BOM 효율성 분석', '원자재 사용량 최적화', '대체 원자재 비용 비교'],
      };

      console.log('[DashboardPlanning] 데이터 구조:', JSON.stringify(dataStructure, null, 2));

      const costDebateId = await chiefOrchestrator.orchestrateDebate({
        team: 'cost-management-team',
        topic: '원가 분석 대시보드 설계 및 분석 방법론',
        contextData: {
          dataStructure,
          analysisOpportunities,
          userGoal: '사용자가 직관적으로 원가 현황을 파악하고 원가 절감 활동을 수행할 수 있는 대시보드 설계',
          requirements: [
            '실시간 원가 현황 모니터링',
            '품목별/기간별 원가 추이 시각화',
            '원가 절감 기회 자동 식별',
            '실행 가능한 권고사항 제시',
          ],
        },
        priority: 'critical',
      });

      const bomDebateId = await chiefOrchestrator.orchestrateDebate({
        team: 'bom-waste-team',
        topic: 'BOM 기반 원가 분석 대시보드 설계',
        contextData: {
          bomStructure: dataStructure.bom,
          analysisGoals: ['BOM 구조 시각화', '원자재 비용 영향도 분석', '대체 원자재 시뮬레이션'],
        },
        priority: 'high',
      });

      const profitDebateId = await chiefOrchestrator.orchestrateDebate({
        team: 'profitability-team',
        topic: '수익성 분석 대시보드 설계',
        contextData: {
          salesData: dataStructure.sales,
          purchaseData: dataStructure.purchases,
          analysisGoals: ['품목별 마진율 시각화', '수익성 기반 품목 분류', '가격 조정 시뮬레이션'],
        },
        priority: 'high',
      });

      res.json({
        success: true,
        message: '대시보드 기획 에이전트 회의 소집 완료',
        dataStructure,
        analysisOpportunities,
        debates: { costDebateId, bomDebateId, profitDebateId },
      });
    } catch (error: unknown) {
      console.error('[DashboardPlanning] 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
