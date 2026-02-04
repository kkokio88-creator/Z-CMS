/**
 * 원가 팀 (Trio)
 * 도메인: 원가 관리, 비용 구조 분석, 원가 최적화
 *
 * - Optimist: 원가 절감 기회
 * - Pessimist: 원가 상승 리스크
 * - Mediator: 원가 구조 최적화 권고
 */

import { OptimistPersona } from '../personas/OptimistPersona.js';
import { PessimistPersona } from '../personas/PessimistPersona.js';
import { MediatorPersona } from '../personas/MediatorPersona.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

export interface CostTeam {
  optimist: OptimistPersona;
  pessimist: PessimistPersona;
  mediator: MediatorPersona;
  start: () => void;
  stop: () => void;
  injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => void;
}

/**
 * 원가 팀 생성 팩토리
 */
export function createCostTeam(
  eventBus: EventBus,
  stateManager: StateManager,
  learningRegistry: LearningRegistry
): CostTeam {
  const optimist = new OptimistPersona(
    'cost-optimist',
    'cost-management-team',
    'general',
    eventBus,
    stateManager,
    learningRegistry
  );

  const pessimist = new PessimistPersona(
    'cost-pessimist',
    'cost-management-team',
    'general',
    eventBus,
    stateManager,
    learningRegistry
  );

  const mediator = new MediatorPersona(
    'cost-mediator',
    'cost-management-team',
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
      console.log('[CostTeam] 팀 시작됨');
    },
    stop: () => {
      optimist.stop();
      pessimist.stop();
      mediator.stop();
      console.log('[CostTeam] 팀 중지됨');
    },
    injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => {
      optimist.injectDependencies(debateManager, geminiAdapter);
      pessimist.injectDependencies(debateManager, geminiAdapter);
      mediator.injectDependencies(debateManager, geminiAdapter);
    }
  };
}

export { OptimistPersona as CostOptimist };
export { PessimistPersona as CostPessimist };
export { MediatorPersona as CostMediator };
