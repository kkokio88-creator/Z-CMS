/**
 * 토론 매니저
 * 변증법적 토론(정-반-합) 프로세스 관리
 * SOP: 에이전틱 멀티-레이어 조직 운영 가이드 v2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  DebateRecord,
  DebateRound,
  DebatePhase,
  DomainTeam,
  InsightDomain,
  TrioRole,
  GovernanceReview,
  FinalDecision,
  DebateStartRequest,
  DebateEvent,
  DebateStatistics,
  MessagePriority,
} from '../types';
import { WipManager } from './WipManager';

// 팀 -> 도메인 매핑
const TEAM_TO_DOMAIN: Record<DomainTeam, InsightDomain> = {
  'bom-waste-team': 'bom',
  'inventory-team': 'inventory',
  'profitability-team': 'profitability',
  'cost-management-team': 'general',
  'business-strategy-team': 'general',
};

export class DebateManager extends EventEmitter {
  private activeDebates: Map<string, DebateRecord> = new Map();
  private debateHistory: DebateRecord[] = [];
  private debateQueue: DebateStartRequest[] = [];
  private wipManager: WipManager;
  private maxActiveDebates: number;
  private maxHistorySize: number;

  constructor(
    wipManager: WipManager,
    options: {
      maxActiveDebates?: number;
      maxHistorySize?: number;
    } = {}
  ) {
    super();
    this.wipManager = wipManager;
    this.maxActiveDebates = options.maxActiveDebates ?? 10;
    this.maxHistorySize = options.maxHistorySize ?? 100;
  }

  /**
   * 새 토론 시작
   */
  async initiateDebate(request: DebateStartRequest): Promise<string> {
    // 동시 토론 수 제한 확인
    if (this.activeDebates.size >= this.maxActiveDebates) {
      if (request.immediate) {
        throw new Error(`최대 동시 토론 수(${this.maxActiveDebates})를 초과했습니다.`);
      }
      // 큐에 추가
      this.debateQueue.push(request);
      console.log(`[DebateManager] 토론 대기열에 추가: ${request.topic}`);
      return 'queued';
    }

    const debateId = uuidv4();
    const domain = TEAM_TO_DOMAIN[request.team];

    // 같은 주제의 이전 토론 버전 확인
    const previousVersions = this.debateHistory.filter(
      d => d.topic === request.topic && d.team === request.team
    );
    const version = previousVersions.length + 1;

    const debate: DebateRecord = {
      id: debateId,
      domain,
      team: request.team,
      topic: request.topic,
      contextData: request.contextData,
      currentPhase: 'thesis',
      startedAt: new Date(),
      version,
    };

    this.activeDebates.set(debateId, debate);

    // WIP 파일 생성
    await this.wipManager.writeDebateLog(debate);

    // 이벤트 발행
    this.emitDebateEvent('debate_started', debate);

    console.log(`[DebateManager] 토론 시작: ${debateId} - ${request.topic}`);
    return debateId;
  }

  /**
   * 토론 라운드 기록
   */
  async recordRound(debateId: string, round: DebateRound): Promise<void> {
    const debate = this.activeDebates.get(debateId);
    if (!debate) {
      throw new Error(`토론을 찾을 수 없습니다: ${debateId}`);
    }

    // 라운드 타입에 따라 저장
    switch (round.phase) {
      case 'thesis':
        debate.thesis = round;
        debate.currentPhase = 'antithesis';
        break;
      case 'antithesis':
        debate.antithesis = round;
        debate.currentPhase = 'synthesis';
        break;
      case 'synthesis':
        debate.synthesis = round;
        debate.currentPhase = 'governance_review';
        break;
      default:
        throw new Error(`잘못된 토론 단계: ${round.phase}`);
    }

    // WIP 파일 업데이트
    await this.wipManager.updateDebateLog(debateId, debate);

    // 이벤트 발행
    this.emitDebateEvent('round_completed', debate);

    console.log(`[DebateManager] 라운드 기록: ${debateId} - ${round.phase}`);
  }

  /**
   * 거버넌스 검토 추가
   */
  async addGovernanceReview(
    debateId: string,
    review: Omit<GovernanceReview, 'id' | 'debateId'>
  ): Promise<void> {
    const debate = this.activeDebates.get(debateId);
    if (!debate) {
      throw new Error(`토론을 찾을 수 없습니다: ${debateId}`);
    }

    const fullReview: GovernanceReview = {
      id: uuidv4(),
      debateId,
      ...review,
    };

    if (!debate.governanceReviews) {
      debate.governanceReviews = [];
    }
    debate.governanceReviews.push(fullReview);

    // WIP 파일 업데이트
    await this.wipManager.updateDebateLog(debateId, debate);

    // 이벤트 발행
    this.emitDebateEvent('governance_reviewed', debate);

    console.log(`[DebateManager] 거버넌스 검토 추가: ${debateId} - ${review.reviewerId}`);
  }

  /**
   * 토론 완료
   */
  async completeDebate(debateId: string, finalDecision: FinalDecision): Promise<DebateRecord> {
    const debate = this.activeDebates.get(debateId);
    if (!debate) {
      throw new Error(`토론을 찾을 수 없습니다: ${debateId}`);
    }

    debate.finalDecision = finalDecision;
    debate.currentPhase = 'complete';
    debate.completedAt = new Date();

    // 활성 토론에서 제거하고 히스토리에 추가
    this.activeDebates.delete(debateId);
    this.debateHistory.unshift(debate);

    // 히스토리 크기 제한
    if (this.debateHistory.length > this.maxHistorySize) {
      this.debateHistory = this.debateHistory.slice(0, this.maxHistorySize);
    }

    // WIP 파일 최종 업데이트
    await this.wipManager.updateDebateLog(debateId, debate);

    // 이벤트 발행
    this.emitDebateEvent('debate_completed', debate);

    console.log(`[DebateManager] 토론 완료: ${debateId}`);

    // 대기열에서 다음 토론 시작
    await this.processQueue();

    return debate;
  }

  /**
   * 대기열 처리
   */
  private async processQueue(): Promise<void> {
    if (this.debateQueue.length === 0) return;
    if (this.activeDebates.size >= this.maxActiveDebates) return;

    const nextRequest = this.debateQueue.shift()!;
    await this.initiateDebate(nextRequest);
  }

  /**
   * 토론 이벤트 발행
   */
  private emitDebateEvent(type: DebateEvent['type'], debate: DebateRecord): void {
    const event: DebateEvent = {
      type,
      debateId: debate.id,
      data: {
        id: debate.id,
        domain: debate.domain,
        team: debate.team,
        topic: debate.topic,
        currentPhase: debate.currentPhase,
      },
      timestamp: new Date(),
    };
    this.emit('debate_event', event);
  }

  /**
   * 활성 토론 조회
   */
  getActiveDebate(debateId: string): DebateRecord | undefined {
    return this.activeDebates.get(debateId);
  }

  /**
   * 모든 활성 토론 조회
   */
  getAllActiveDebates(): DebateRecord[] {
    return Array.from(this.activeDebates.values());
  }

  /**
   * 팀별 활성 토론 조회
   */
  getActiveDebatesByTeam(team: DomainTeam): DebateRecord[] {
    return Array.from(this.activeDebates.values()).filter(d => d.team === team);
  }

  /**
   * 토론 히스토리 조회
   */
  getDebateHistory(options?: {
    domain?: InsightDomain;
    team?: DomainTeam;
    limit?: number;
  }): DebateRecord[] {
    let results = [...this.debateHistory];

    if (options?.domain) {
      results = results.filter(d => d.domain === options.domain);
    }
    if (options?.team) {
      results = results.filter(d => d.team === options.team);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 토론 통계 조회
   */
  getStatistics(): DebateStatistics {
    const allDebates = [...this.debateHistory];
    const completedDebates = allDebates.filter(d => d.currentPhase === 'complete');

    const totalConfidence = completedDebates.reduce(
      (sum, d) => sum + (d.finalDecision?.confidence || 0),
      0
    );

    const totalDuration = completedDebates.reduce((sum, d) => {
      if (d.completedAt && d.startedAt) {
        return sum + (d.completedAt.getTime() - d.startedAt.getTime());
      }
      return sum;
    }, 0);

    const approvedDebates = completedDebates.filter(d =>
      d.governanceReviews?.every(r => r.approved)
    );

    const byDomain: Record<InsightDomain, number> = {
      bom: 0,
      waste: 0,
      inventory: 0,
      profitability: 0,
      general: 0,
    };

    const byTeam: Record<DomainTeam, number> = {
      'bom-waste-team': 0,
      'inventory-team': 0,
      'profitability-team': 0,
      'cost-management-team': 0,
      'business-strategy-team': 0,
    };

    allDebates.forEach(d => {
      byDomain[d.domain]++;
      byTeam[d.team]++;
    });

    return {
      totalDebates: allDebates.length,
      completedDebates: completedDebates.length,
      averageConfidence:
        completedDebates.length > 0 ? totalConfidence / completedDebates.length : 0,
      averageDuration: completedDebates.length > 0 ? totalDuration / completedDebates.length : 0,
      governanceApprovalRate:
        completedDebates.length > 0 ? approvedDebates.length / completedDebates.length : 0,
      byDomain,
      byTeam,
    };
  }

  /**
   * 토론 취소
   */
  async cancelDebate(debateId: string, reason: string): Promise<void> {
    const debate = this.activeDebates.get(debateId);
    if (!debate) {
      throw new Error(`토론을 찾을 수 없습니다: ${debateId}`);
    }

    debate.currentPhase = 'complete';
    debate.completedAt = new Date();
    debate.finalDecision = {
      recommendation: '토론 취소됨',
      reasoning: reason,
      confidence: 0,
      actions: [],
      priority: 'low',
    };

    this.activeDebates.delete(debateId);
    this.debateHistory.unshift(debate);

    await this.wipManager.updateDebateLog(debateId, debate);

    console.log(`[DebateManager] 토론 취소: ${debateId} - ${reason}`);
  }

  /**
   * C.A.T.S 명령 생성 헬퍼
   */
  createCATSCommand(
    role: TrioRole,
    task: string,
    debate: DebateRecord
  ): {
    context: string;
    agentRole: TrioRole;
    task: string;
    successCriteria: string;
  } {
    const roleDescriptions: Record<TrioRole, string> = {
      optimist: '가능성, 확장성, 창의적 대안 제시에 집중',
      pessimist: '제약 조건, 리스크, 잠재적 실패 요인 분석',
      mediator: '두 관점을 통합하여 실행 가능한 최적의 결론 도출',
    };

    const successCriteriaByRole: Record<TrioRole, string> = {
      optimist:
        'position(주장), reasoning(추론), evidence(근거), confidence(신뢰도 0-100)를 포함한 JSON 형식',
      pessimist:
        'position(반론), reasoning(리스크 분석), evidence(위험 요소), confidence(신뢰도 0-100)를 포함한 JSON 형식',
      mediator:
        'position(종합), reasoning(균형 분석), suggestedActions(권고 조치), confidence(신뢰도 0-100)를 포함한 JSON 형식',
    };

    return {
      context: `[${debate.domain}] ${debate.topic}\n배경 데이터: ${JSON.stringify(debate.contextData).slice(0, 500)}...`,
      agentRole: role,
      task: `${roleDescriptions[role]}. ${task}`,
      successCriteria: successCriteriaByRole[role],
    };
  }

  /**
   * 대기열 상태 조회
   */
  getQueueStatus(): {
    activeCount: number;
    queuedCount: number;
    maxActive: number;
  } {
    return {
      activeCount: this.activeDebates.size,
      queuedCount: this.debateQueue.length,
      maxActive: this.maxActiveDebates,
    };
  }
}
