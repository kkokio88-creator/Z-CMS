/**
 * 사업전략 팀 (Trio)
 * 도메인: 사업 전략, 시장 기회, 경쟁력 분석, 성장 전략
 *
 * - Optimist: 성장 기회와 확장 가능성
 * - Pessimist: 리스크와 제약 조건
 * - Mediator: 균형 잡힌 사업 전략 도출
 */

import { OptimistPersona } from '../personas/OptimistPersona.js';
import { PessimistPersona } from '../personas/PessimistPersona.js';
import { MediatorPersona } from '../personas/MediatorPersona.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

export interface BusinessTeam {
  optimist: OptimistPersona;
  pessimist: PessimistPersona;
  mediator: MediatorPersona;
  start: () => void;
  stop: () => void;
  injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => void;
}

/**
 * 사업전략 팀 생성 팩토리
 */
export function createBusinessTeam(
  eventBus: EventBus,
  stateManager: StateManager,
  learningRegistry: LearningRegistry
): BusinessTeam {
  const optimist = new OptimistPersona(
    'business-optimist',
    'business-strategy-team',
    'general', // business 도메인은 서버에서 general로 매핑
    eventBus,
    stateManager,
    learningRegistry
  );

  const pessimist = new PessimistPersona(
    'business-pessimist',
    'business-strategy-team',
    'general',
    eventBus,
    stateManager,
    learningRegistry
  );

  const mediator = new MediatorPersona(
    'business-mediator',
    'business-strategy-team',
    'general',
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
      console.log('[BusinessTeam] 팀 시작됨');
    },
    stop: () => {
      optimist.stop();
      pessimist.stop();
      mediator.stop();
      console.log('[BusinessTeam] 팀 중지됨');
    },
    injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => {
      optimist.injectDependencies(debateManager, geminiAdapter);
      pessimist.injectDependencies(debateManager, geminiAdapter);
      mediator.injectDependencies(debateManager, geminiAdapter);
    },
  };
}

export { OptimistPersona as BusinessOptimist };
export { PessimistPersona as BusinessPessimist };
export { MediatorPersona as BusinessMediator };
