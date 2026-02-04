/**
 * 재고 팀 (Trio)
 * 도메인: 재고 관리, 안전재고, 재고 이상 감지
 *
 * - Optimist: 재고 최적화 기회
 * - Pessimist: 품절/과잉 재고 리스크
 * - Mediator: 안전재고 권고
 */

import { OptimistPersona } from '../personas/OptimistPersona.js';
import { PessimistPersona } from '../personas/PessimistPersona.js';
import { MediatorPersona } from '../personas/MediatorPersona.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

export interface InventoryTeam {
  optimist: OptimistPersona;
  pessimist: PessimistPersona;
  mediator: MediatorPersona;
  start: () => void;
  stop: () => void;
  injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => void;
}

/**
 * 재고 팀 생성 팩토리
 */
export function createInventoryTeam(
  eventBus: EventBus,
  stateManager: StateManager,
  learningRegistry: LearningRegistry
): InventoryTeam {
  const optimist = new OptimistPersona(
    'inventory-optimist',
    'inventory-team',
    'inventory',
    eventBus,
    stateManager,
    learningRegistry
  );

  const pessimist = new PessimistPersona(
    'inventory-pessimist',
    'inventory-team',
    'inventory',
    eventBus,
    stateManager,
    learningRegistry
  );

  const mediator = new MediatorPersona(
    'inventory-mediator',
    'inventory-team',
    'inventory',
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
      console.log('[InventoryTeam] 팀 시작됨');
    },
    stop: () => {
      optimist.stop();
      pessimist.stop();
      mediator.stop();
      console.log('[InventoryTeam] 팀 중지됨');
    },
    injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => {
      optimist.injectDependencies(debateManager, geminiAdapter);
      pessimist.injectDependencies(debateManager, geminiAdapter);
      mediator.injectDependencies(debateManager, geminiAdapter);
    },
  };
}

export { OptimistPersona as InventoryOptimist };
export { PessimistPersona as InventoryPessimist };
export { MediatorPersona as InventoryMediator };
