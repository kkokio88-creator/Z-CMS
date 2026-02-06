import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { agentRoutes } from './routes/agent.routes.js';
import { ecountRoutes } from './routes/ecount.routes.js';
import { googleSheetRoutes } from './routes/googlesheet.routes.js';
import { sseRoutes } from './routes/sse.routes.js';
import { feedbackRoutes } from './routes/feedback.routes.js';
import { costReportRoutes } from './routes/costReport.routes.js';
import costAnalysisRoutes from './routes/costAnalysis.routes.js';
import orderingRoutes from './routes/ordering.routes.js';
import sheetsRoutes from './routes/sheets.routes.js';
import { createDebateRoutes } from './routes/debate.routes.js';
import { createGovernanceRoutes } from './routes/governance.routes.js';
import { EventBus } from './services/EventBus.js';
import { StateManager } from './services/StateManager.js';
import { LearningRegistry } from './services/LearningRegistry.js';
import { WipManager } from './services/WipManager.js';
import { DebateManager } from './services/DebateManager.js';
// 레거시 에이전트 (병행 운영)
import { CoordinatorAgent } from './agents/coordinator/CoordinatorAgent.js';
import { BomWasteAgent } from './agents/bom-waste/BomWasteAgent.js';
import { InventoryAgent } from './agents/inventory/InventoryAgent.js';
import { ProfitabilityAgent } from './agents/profitability/ProfitabilityAgent.js';
import { CostManagementAgent } from './agents/cost-management/CostManagementAgent.js';
// 새 Trio 팀
import { createBomWasteTeam } from './agents/bom-waste-team/index.js';
import { createInventoryTeam } from './agents/inventory-team/index.js';
import { createProfitabilityTeam } from './agents/profitability-team/index.js';
import { createCostTeam } from './agents/cost-team/index.js';
// 거버넌스 에이전트
import { QASpecialist } from './agents/governance/QASpecialist.js';
import { ComplianceAuditor } from './agents/governance/ComplianceAuditor.js';
// Chief Orchestrator
import { ChiefOrchestrator } from './agents/orchestrator/ChiefOrchestrator.js';
import { geminiAdapter } from './adapters/GeminiAdapter.js';
import { multiSpreadsheetAdapter } from './adapters/GoogleSheetsAdapter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[],
    credentials: true,
  })
);
app.use(express.json());

// Initialize shared services
const eventBus = new EventBus();
const stateManager = new StateManager();
const learningRegistry = new LearningRegistry();

// Initialize WIP and Debate managers
const wipManager = new WipManager('./wip');
const debateManager = new DebateManager(wipManager, {
  maxActiveDebates: 10,
  maxHistorySize: 100,
});

// Initialize WIP folder
wipManager.initialize().catch(err => {
  console.warn('[Server] WIP 폴더 초기화 실패:', err.message);
});

// ================================
// 레거시 에이전트 (병행 운영)
// ================================
const bomWasteAgent = new BomWasteAgent(eventBus, stateManager, learningRegistry);
const inventoryAgent = new InventoryAgent(eventBus, stateManager, learningRegistry);
const profitabilityAgent = new ProfitabilityAgent(eventBus, stateManager, learningRegistry);
const costManagementAgent = new CostManagementAgent(eventBus, stateManager, learningRegistry);
const coordinatorAgent = new CoordinatorAgent(eventBus, stateManager, learningRegistry, [
  bomWasteAgent,
  inventoryAgent,
  profitabilityAgent,
  costManagementAgent,
]);

// Start legacy agents
bomWasteAgent.start();
inventoryAgent.start();
profitabilityAgent.start();
costManagementAgent.start();
coordinatorAgent.start();

// ================================
// 새 Trio 팀 (변증법적 토론)
// ================================
const bomWasteTeam = createBomWasteTeam(eventBus, stateManager, learningRegistry);
const inventoryTeam = createInventoryTeam(eventBus, stateManager, learningRegistry);
const profitabilityTeam = createProfitabilityTeam(eventBus, stateManager, learningRegistry);
const costTeam = createCostTeam(eventBus, stateManager, learningRegistry);

// Inject dependencies to teams
bomWasteTeam.injectDependencies(debateManager, geminiAdapter);
inventoryTeam.injectDependencies(debateManager, geminiAdapter);
profitabilityTeam.injectDependencies(debateManager, geminiAdapter);
costTeam.injectDependencies(debateManager, geminiAdapter);

// Start Trio teams
bomWasteTeam.start();
inventoryTeam.start();
profitabilityTeam.start();
costTeam.start();

// ================================
// 거버넌스 에이전트
// ================================
const qaSpecialist = new QASpecialist(eventBus, stateManager, learningRegistry);
const complianceAuditor = new ComplianceAuditor(eventBus, stateManager, learningRegistry);

// Inject dependencies
qaSpecialist.injectDependencies(debateManager, geminiAdapter);
complianceAuditor.injectDependencies(debateManager, geminiAdapter);

// Start governance agents
qaSpecialist.start();
complianceAuditor.start();

// ================================
// Chief Orchestrator
// ================================
const chiefOrchestrator = new ChiefOrchestrator(eventBus, stateManager, learningRegistry);

// Register components with Chief Orchestrator
chiefOrchestrator.registerDebateManager(debateManager);
chiefOrchestrator.registerDomainTeams({
  bomWaste: bomWasteTeam,
  inventory: inventoryTeam,
  profitability: profitabilityTeam,
  cost: costTeam,
});
chiefOrchestrator.registerGovernanceAgents({
  qaSpecialist,
  complianceAuditor,
});
chiefOrchestrator.registerLegacyAgents([
  bomWasteAgent,
  inventoryAgent,
  profitabilityAgent,
  costManagementAgent,
]);

// Start Chief Orchestrator
chiefOrchestrator.start();

// Make services available to routes
app.locals.eventBus = eventBus;
app.locals.stateManager = stateManager;
app.locals.learningRegistry = learningRegistry;
app.locals.coordinatorAgent = coordinatorAgent;
app.locals.chiefOrchestrator = chiefOrchestrator;
app.locals.debateManager = debateManager;
app.locals.agents = {
  // 레거시 에이전트
  'bom-waste': bomWasteAgent,
  inventory: inventoryAgent,
  profitability: profitabilityAgent,
  'cost-management': costManagementAgent,
  coordinator: coordinatorAgent,
  // 새 에이전트
  'chief-orchestrator': chiefOrchestrator,
  'qa-specialist': qaSpecialist,
  'compliance-auditor': complianceAuditor,
};

// Routes
app.use('/api/agents', agentRoutes);
app.use('/api/ecount', ecountRoutes);
app.use('/api/googlesheet', googleSheetRoutes);
app.use('/api/stream', sseRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/cost-report', costReportRoutes);
app.use('/api/cost-analysis', costAnalysisRoutes);
app.use('/api/ordering', orderingRoutes);
app.use('/api/sheets', sheetsRoutes);

// 새 라우트: 토론 및 거버넌스
app.use('/api/debates', createDebateRoutes(debateManager, wipManager, chiefOrchestrator));
app.use(
  '/api/governance',
  createGovernanceRoutes(debateManager, eventBus, qaSpecialist, complianceAuditor)
);

// Google Sheets 연결 테스트
app.get('/api/sheets/test', async (_req, res) => {
  try {
    const result = await multiSpreadsheetAdapter.testConnections();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 원가 분석 데이터 조회
app.get('/api/sheets/cost-data', async (_req, res) => {
  try {
    const data = await multiSpreadsheetAdapter.fetchAllCostAnalysisData();
    res.json({
      success: true,
      data,
      summary: {
        salesCount: data.sales.length,
        purchaseCount: data.purchases.length,
        bomCount: data.bom.length,
        fetchedAt: data.fetchedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 원가 분석 에이전트 회의 소집
app.post('/api/cost-analysis/convene', async (req, res) => {
  try {
    // 1. 데이터 가져오기
    console.log('[CostAnalysis] 데이터 가져오는 중...');
    const costData = await multiSpreadsheetAdapter.fetchAllCostAnalysisData();

    // 2. 데이터 요약 생성
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
      // 주요 품목 요약
      topItems: {
        sales: [...new Set(costData.sales.map(s => s.itemName))].slice(0, 10),
        purchases: [...new Set(costData.purchases.map(p => p.itemName))].slice(0, 10),
        bom: costData.bom.map(b => b.parentItemName).slice(0, 10),
      },
    };

    console.log('[CostAnalysis] 데이터 요약:', JSON.stringify(dataSummary, null, 2));

    // 3. 원가 분석 팀 토론 시작
    console.log('[CostAnalysis] 원가 분석 토론 시작...');
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

    // 4. BOM 팀 토론도 시작 (원가와 연관)
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
      debates: {
        costDebateId: debateId,
        bomDebateId: bomDebateId,
      },
    });
  } catch (error: any) {
    console.error('[CostAnalysis] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 대시보드 기획 회의 소집
app.post('/api/dashboard-planning/convene', async (req, res) => {
  try {
    // 1. 데이터 가져오기
    console.log('[DashboardPlanning] 데이터 가져오는 중...');
    const costData = await multiSpreadsheetAdapter.fetchAllCostAnalysisData();

    // 2. 데이터 구조 분석
    const dataStructure = {
      sales: {
        count: costData.sales.length,
        fields: costData.sales.length > 0 ? Object.keys(costData.sales[0]) : [],
        sampleItems: costData.sales.slice(0, 5).map(s => s.itemName),
        uniqueItems: [...new Set(costData.sales.map(s => s.itemName))].length,
        totalAmount: costData.sales.reduce((sum, s) => sum + s.amount, 0),
      },
      purchases: {
        count: costData.purchases.length,
        fields: costData.purchases.length > 0 ? Object.keys(costData.purchases[0]) : [],
        sampleItems: costData.purchases.slice(0, 5).map(p => p.itemName),
        uniqueItems: [...new Set(costData.purchases.map(p => p.itemName))].length,
        totalAmount: costData.purchases.reduce((sum, p) => sum + p.amount, 0),
      },
      bom: {
        count: costData.bom.length,
        fields: costData.bom.length > 0 ? Object.keys(costData.bom[0]) : [],
        sampleParents: [...new Set(costData.bom.map(b => b.parentItemName))].slice(0, 5),
      },
    };

    // 3. 분석 가능한 지표 정의
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

    // 4. 원가 분석팀 토론 - 대시보드 기획
    console.log('[DashboardPlanning] 대시보드 기획 토론 시작...');
    const costDebateId = await chiefOrchestrator.orchestrateDebate({
      team: 'cost-management-team',
      topic: '원가 분석 대시보드 설계 및 분석 방법론',
      contextData: {
        dataStructure,
        analysisOpportunities,
        userGoal:
          '사용자가 직관적으로 원가 현황을 파악하고 원가 절감 활동을 수행할 수 있는 대시보드 설계',
        requirements: [
          '실시간 원가 현황 모니터링',
          '품목별/기간별 원가 추이 시각화',
          '원가 절감 기회 자동 식별',
          '실행 가능한 권고사항 제시',
        ],
      },
      priority: 'critical',
    });

    // 5. BOM 팀 토론 - BOM 기반 분석
    const bomDebateId = await chiefOrchestrator.orchestrateDebate({
      team: 'bom-waste-team',
      topic: 'BOM 기반 원가 분석 대시보드 설계',
      contextData: {
        bomStructure: dataStructure.bom,
        analysisGoals: ['BOM 구조 시각화', '원자재 비용 영향도 분석', '대체 원자재 시뮬레이션'],
      },
      priority: 'high',
    });

    // 6. 수익성 팀 토론 - 마진 분석
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
      debates: {
        costDebateId,
        bomDebateId,
        profitDebateId,
      },
    });
  } catch (error: any) {
    console.error('[DashboardPlanning] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  const debateStatus = chiefOrchestrator.getDebateStatus();
  const teamStatuses = chiefOrchestrator.getAllTeamStatuses();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    // 레거시 에이전트
    legacyAgents: {
      coordinator: coordinatorAgent.getStatus(),
      bomWaste: bomWasteAgent.getStatus(),
      inventory: inventoryAgent.getStatus(),
      profitability: profitabilityAgent.getStatus(),
      costManagement: costManagementAgent.getStatus(),
    },
    // 새 에이전틱 시스템
    agenticSystem: {
      chiefOrchestrator: chiefOrchestrator.getStatus(),
      governance: {
        qaSpecialist: qaSpecialist.getStatus(),
        complianceAuditor: complianceAuditor.getStatus(),
      },
      teams: teamStatuses,
      debates: debateStatus,
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Z-CMS Agent Server running on port ${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/stream`);
  console.log(
    `🤖 레거시 에이전트: Coordinator, BOM/Waste, Inventory, Profitability, CostManagement`
  );
  console.log(`🎯 Trio 팀 (정-반-합): BOM/Waste, Inventory, Profitability, Cost (12 에이전트)`);
  console.log(`🛡️ 거버넌스: QA Specialist, Compliance Auditor`);
  console.log(`👑 Chief Orchestrator: 활성화됨`);
  console.log(`📁 WIP 폴더: ./wip`);
  console.log(`✨ 에이전틱 멀티-레이어 프레임워크 준비 완료`);
});
