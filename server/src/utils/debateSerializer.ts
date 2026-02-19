/**
 * Debate 직렬화/역직렬화
 * DebateRecord ↔ DB row 변환 유틸리티
 */

import type { DebateRecord, DebateRound, GovernanceReview, FinalDecision, DebatePhase, DomainTeam, InsightDomain } from '../types/index.js';

export interface DebateRow {
  id: string;
  domain: string;
  team: string;
  topic: string;
  version: number;
  current_phase: string;
  context_data: unknown;
  thesis: unknown | null;
  antithesis: unknown | null;
  synthesis: unknown | null;
  final_decision: unknown | null;
  governance_reviews: unknown[];
  started_at: string;
  completed_at: string | null;
}

/** DebateRecord → DB row (insert/update용) */
export function debateRecordToRow(record: DebateRecord): DebateRow {
  return {
    id: record.id,
    domain: record.domain,
    team: record.team,
    topic: record.topic,
    version: record.version,
    current_phase: record.currentPhase,
    context_data: record.contextData,
    thesis: record.thesis ? roundToJson(record.thesis) : null,
    antithesis: record.antithesis ? roundToJson(record.antithesis) : null,
    synthesis: record.synthesis ? roundToJson(record.synthesis) : null,
    final_decision: record.finalDecision ?? null,
    governance_reviews: (record.governanceReviews ?? []).map(reviewToJson),
    started_at: record.startedAt.toISOString(),
    completed_at: record.completedAt?.toISOString() ?? null,
  };
}

/** DB row → DebateRecord */
export function debateRowToRecord(row: DebateRow): DebateRecord {
  return {
    id: row.id,
    domain: row.domain as InsightDomain,
    team: row.team as DomainTeam,
    topic: row.topic,
    version: row.version,
    currentPhase: row.current_phase as DebatePhase,
    contextData: row.context_data,
    thesis: row.thesis ? jsonToRound(row.thesis) : undefined,
    antithesis: row.antithesis ? jsonToRound(row.antithesis) : undefined,
    synthesis: row.synthesis ? jsonToRound(row.synthesis) : undefined,
    finalDecision: row.final_decision ? (row.final_decision as FinalDecision) : undefined,
    governanceReviews: Array.isArray(row.governance_reviews)
      ? row.governance_reviews.map(jsonToReview)
      : undefined,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

function roundToJson(round: DebateRound): unknown {
  return {
    ...round,
    timestamp: round.timestamp.toISOString(),
  };
}

function jsonToRound(json: unknown): DebateRound {
  const obj = json as Record<string, unknown>;
  return {
    ...obj,
    timestamp: new Date(obj.timestamp as string),
  } as DebateRound;
}

function reviewToJson(review: GovernanceReview): unknown {
  return {
    ...review,
    timestamp: review.timestamp.toISOString(),
  };
}

function jsonToReview(json: unknown): GovernanceReview {
  const obj = json as Record<string, unknown>;
  return {
    ...obj,
    timestamp: new Date(obj.timestamp as string),
  } as GovernanceReview;
}
