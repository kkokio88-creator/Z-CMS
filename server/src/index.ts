import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import { createConveneRoutes } from './routes/convene.routes.js';
import { createHealthRoutes } from './routes/health.routes.js';
import supabaseRoutes from './routes/supabase.routes.js';
import { supabaseAdapter } from './adapters/SupabaseAdapter.js';
import { syncService } from './services/SyncService.js';
import { cacheMiddleware, cache, createCacheRoutes } from './middleware/cache.js';
import { errorHandler } from './middleware/errorHandler.js';
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
const PORT = process.env.PORT || 4001;

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow: no origin (server-to-server), localhost, Vercel previews, FRONTEND_URL
      if (
        !origin ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /\.vercel\.app$/.test(origin) ||
        origin === process.env.FRONTEND_URL
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP는 프론트엔드에서 별도 관리
    crossOriginEmbedderPolicy: false,
  })
);

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 15분 후에 다시 시도해주세요.' },
});

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '동기화 요청이 너무 많습니다. 15분 후에 다시 시도해주세요.' },
});

const dataLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '데이터 요청이 너무 많습니다. 15분 후에 다시 시도해주세요.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI 분석 요청이 너무 많습니다. 15분 후에 다시 시도해주세요.' },
});

app.use('/api/sync', syncLimiter);
app.use('/api/data', dataLimiter);
app.use('/api/debates', aiLimiter);
app.use('/api/agents', aiLimiter);
app.use('/api/governance', aiLimiter);
app.use('/api/cost-analysis/convene', aiLimiter);
app.use('/api/dashboard-planning/convene', aiLimiter);
app.use('/api', globalLimiter);

// Initialize shared services
const eventBus = new EventBus();
const stateManager = new StateManager();
const learningRegistry = new LearningRegistry();

// Initialize WIP and Debate managers
const wipManager = new WipManager('./wip');
const debateManager = new DebateManager(wipManager, {
  maxActiveDebates: 10,
  maxHistorySize: 100,
  persistence: supabaseAdapter.isConfigured() ? supabaseAdapter : undefined,
});

// Initialize WIP folder
wipManager.initialize().catch(err => {
  console.warn('[Server] WIP 폴더 초기화 실패:', err.message);
});

// DB에서 토론 복원
debateManager.restoreFromDatabase().catch(err => {
  console.warn('[Server] 토론 DB 복원 실패:', err instanceof Error ? err.message : String(err));
});

// ================================
// 에이전트 모드: legacy | trio | both (기본: both)
// ================================
const AGENT_MODE = (process.env.AGENT_MODE || 'both') as 'legacy' | 'trio' | 'both';

// 레거시 에이전트
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

if (AGENT_MODE === 'legacy' || AGENT_MODE === 'both') {
  bomWasteAgent.start();
  inventoryAgent.start();
  profitabilityAgent.start();
  costManagementAgent.start();
  coordinatorAgent.start();
  console.log(`[AgentMode] 레거시 에이전트 시작됨`);
}

// 새 Trio 팀 (변증법적 토론)
const bomWasteTeam = createBomWasteTeam(eventBus, stateManager, learningRegistry);
const inventoryTeam = createInventoryTeam(eventBus, stateManager, learningRegistry);
const profitabilityTeam = createProfitabilityTeam(eventBus, stateManager, learningRegistry);
const costTeam = createCostTeam(eventBus, stateManager, learningRegistry);

bomWasteTeam.injectDependencies(debateManager, geminiAdapter);
inventoryTeam.injectDependencies(debateManager, geminiAdapter);
profitabilityTeam.injectDependencies(debateManager, geminiAdapter);
costTeam.injectDependencies(debateManager, geminiAdapter);

// 거버넌스 에이전트
const qaSpecialist = new QASpecialist(eventBus, stateManager, learningRegistry);
const complianceAuditor = new ComplianceAuditor(eventBus, stateManager, learningRegistry);

qaSpecialist.injectDependencies(debateManager, geminiAdapter);
complianceAuditor.injectDependencies(debateManager, geminiAdapter);

if (AGENT_MODE === 'trio' || AGENT_MODE === 'both') {
  bomWasteTeam.start();
  inventoryTeam.start();
  profitabilityTeam.start();
  costTeam.start();
  qaSpecialist.start();
  complianceAuditor.start();
  console.log(`[AgentMode] Trio 팀 + 거버넌스 시작됨`);
}

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

// 데이터 GET 엔드포인트에 캐시 미들웨어 적용
app.use('/api/data', cacheMiddleware);
app.use('/api/cache', createCacheRoutes());

// 동기화 완료 시 데이터 캐시 무효화 (supabaseRoutes 보다 먼저 등록)
app.use('/api/sync', (_req, _res, next) => {
  if (_req.method === 'POST') {
    cache.invalidatePattern('/api/data');
  }
  next();
});

// Supabase 데이터/동기화 라우트
app.use('/api', supabaseRoutes);

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
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
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
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 회의 소집 라우트 (convene.routes.ts로 분리)
app.use('/api', createConveneRoutes(chiefOrchestrator, multiSpreadsheetAdapter));

// Health check 라우트 (health.routes.ts로 분리)
app.use('/api', createHealthRoutes(chiefOrchestrator, {
  coordinator: coordinatorAgent,
  bomWaste: bomWasteAgent,
  inventory: inventoryAgent,
  profitability: profitabilityAgent,
  costManagement: costManagementAgent,
}));

// ================================
// Supabase 자동 동기화
// ================================
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1시간

async function runAutoSync() {
  if (!supabaseAdapter.isConfigured()) {
    console.log('[AutoSync] Supabase 미설정 - 자동 동기화 건너뜀');
    return;
  }

  try {
    const connResult = await supabaseAdapter.testConnection();
    if (!connResult.success) {
      console.warn('[AutoSync] Supabase 연결 실패:', connResult.message);
      return;
    }

    // Google Sheets: 증분 동기화 (해시 기반, 변경분만 저장)
    const gsResult = await syncService.syncIncremental(false);
    if (gsResult.records && Object.keys(gsResult.records).length > 0) {
      console.log(`[AutoSync] GS 동기화 완료: ${JSON.stringify(gsResult.records)}`);
      if (gsResult.skippedTables?.length) {
        console.log(`[AutoSync] GS 스킵 테이블: ${gsResult.skippedTables.join(', ')}`);
      }
    }

    // ECOUNT: 재고 동기화 (1시간 간격)
    const ecountMinutes = await syncService.getMinutesSinceLastSync('ecount');
    if (ecountMinutes === null || ecountMinutes >= 60) {
      await syncService.syncFromEcount();
    }
  } catch (err: any) {
    console.error('[AutoSync] 오류:', err.message);
  }
}

async function runInitialSyncWithRetry(maxRetries: number, retryDelayMs: number) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[InitialSync] 시도 ${attempt}/${maxRetries}...`);
      await runAutoSync();
      console.log(`[InitialSync] 초기 동기화 성공 (시도 ${attempt})`);
      return;
    } catch (err: any) {
      console.warn(`[InitialSync] 시도 ${attempt} 실패:`, err.message);
      if (attempt < maxRetries) {
        console.log(`[InitialSync] ${retryDelayMs / 1000}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      } else {
        console.error(`[InitialSync] ${maxRetries}회 시도 후 초기 동기화 실패. 주기적 동기화에서 재시도합니다.`);
      }
    }
  }
}

// 공통 에러 핸들러 (모든 라우트 뒤에 등록)
app.use(errorHandler);

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

  // Supabase 상태 확인 및 초기 동기화
  if (supabaseAdapter.isConfigured()) {
    console.log(`💾 Supabase: 설정됨 - 자동 동기화 활성화 (${SYNC_INTERVAL_MS / 60000}분 간격)`);
    // 서버 시작 5초 후 초기 동기화 (3회 재시도, 10초 간격)
    setTimeout(() => runInitialSyncWithRetry(3, 10000), 5000);
    // 주기적 동기화
    setInterval(() => runAutoSync(), SYNC_INTERVAL_MS);
  } else {
    console.log('💾 Supabase: 미설정 - SUPABASE_URL, SUPABASE_KEY 환경변수를 설정하세요');
  }
});
