/**
 * BOM/Waste 팀 (Trio)
 * 도메인: BOM 차이 분석, 폐기물 추적
 *
 * - Optimist: 공정 개선 기회, 비용 절감 잠재력
 * - Pessimist: 품질 리스크, 생산 실패 가능성
 * - Mediator: 균형잡힌 BOM 차이 분석
 */

import { OptimistPersona } from '../personas/OptimistPersona.js';
import { PessimistPersona } from '../personas/PessimistPersona.js';
import { MediatorPersona } from '../personas/MediatorPersona.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

export interface BomWasteTeam {
  optimist: OptimistPersona;
  pessimist: PessimistPersona;
  mediator: MediatorPersona;
  start: () => void;
  stop: () => void;
  injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => void;
}

/**
 * BOM/Waste 팀 생성 팩토리
 */
export function createBomWasteTeam(
  eventBus: EventBus,
  stateManager: StateManager,
  learningRegistry: LearningRegistry
): BomWasteTeam {
  const optimist = new OptimistPersona(
    'bom-waste-optimist',
    'bom-waste-team',
    'bom',
    eventBus,
    stateManager,
    learningRegistry
  );

  const pessimist = new PessimistPersona(
    'bom-waste-pessimist',
    'bom-waste-team',
    'bom',
    eventBus,
    stateManager,
    learningRegistry
  );

  const mediator = new MediatorPersona(
    'bom-waste-mediator',
    'bom-waste-team',
    'bom',
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
      console.log('[BomWasteTeam] 팀 시작됨');
    },
    stop: () => {
      optimist.stop();
      pessimist.stop();
      mediator.stop();
      console.log('[BomWasteTeam] 팀 중지됨');
    },
    injectDependencies: (debateManager: DebateManager, geminiAdapter: GeminiAdapter) => {
      optimist.injectDependencies(debateManager, geminiAdapter);
      pessimist.injectDependencies(debateManager, geminiAdapter);
      mediator.injectDependencies(debateManager, geminiAdapter);
    },
  };
}

export { OptimistPersona as BomWasteOptimist };
export { PessimistPersona as BomWastePessimist };
export { MediatorPersona as BomWasteMediator };
