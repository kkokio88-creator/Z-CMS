/**
 * 수익성 팀 (Trio)
 * 도메인: 채널별 수익성, 마진 분석, 가격 전략
 *
 * - Optimist: 매출 성장 기회
 * - Pessimist: 마진 하락 리스크
 * - Mediator: 채널별 수익성 분석
 */

import { OptimistPersona } from '../personas/OptimistPersona.js';
import { PessimistPersona } from '../personas/PessimistPersona.js';
import { MediatorPersona } from '../personas/MediatorPersona.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

export interface ProfitabilityTeam {
  optimist: OptimistPersona;
  pessimist: PessimistPersona;
  mediator: MediatorPersona;
  start: () => void;
  stop: () => void;
  injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => void;
}

/**
 * 수익성 팀 생성 팩토리
 */
export function createProfitabilityTeam(
  eventBus: EventBus,
  stateManager: StateManager,
  learningRegistry: LearningRegistry
): ProfitabilityTeam {
  const optimist = new OptimistPersona(
    'profitability-optimist',
    'profitability-team',
    'profitability',
    eventBus,
    stateManager,
    learningRegistry
  );

  const pessimist = new PessimistPersona(
    'profitability-pessimist',
    'profitability-team',
    'profitability',
    eventBus,
    stateManager,
    learningRegistry
  );

  const mediator = new MediatorPersona(
    'profitability-mediator',
    'profitability-team',
    'profitability',
    eventBus,
    stateManager,
    learningRegistry
  );

  return {
    optimist,
    pessimist,
    mediator,
    start: () => {
      optimist.start();
      pessimist.start();
      mediator.start();
      console.log('[ProfitabilityTeam] 팀 시작됨');
    },
    stop: () => {
      optimist.stop();
      pessimist.stop();
      mediator.stop();
      console.log('[ProfitabilityTeam] 팀 중지됨');
    },
    injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => {
      optimist.injectDependencies(debateManager, geminiAdapter);
      pessimist.injectDependencies(debateManager, geminiAdapter);
      mediator.injectDependencies(debateManager, geminiAdapter);
    },
  };
}

export { OptimistPersona as ProfitabilityOptimist };
export { PessimistPersona as ProfitabilityPessimist };
export { MediatorPersona as ProfitabilityMediator };
