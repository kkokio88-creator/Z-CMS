/**
 * WIP(Work-In-Progress) 매니저
 * 토론 로그 파일을 /wip 폴더에 관리
 * SOP: 파일 기반 컨텍스트 공유
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DebateRecord, DebatePhase, WipFileMetadata, InsightDomain, DomainTeam } from '../types/index.js';

export class WipManager {
  private wipPath: string;
  private archivePath: string;
  /** debateId → filename 인덱스 (파일 전체 읽기 회피) */
  private debateIndex: Map<string, string> = new Map();

  constructor(basePath: string = './wip') {
    this.wipPath = basePath;
    this.archivePath = path.join(basePath, 'archive');
  }

  /**
   * WIP 폴더 초기화
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.wipPath, { recursive: true });
      await fs.mkdir(this.archivePath, { recursive: true });
      console.log(`[WipManager] WIP 폴더 초기화 완료: ${this.wipPath}`);
    } catch (error) {
      console.error('[WipManager] 폴더 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 토론 로그 파일명 생성
   * Format: debate_v{version}_{domain}_{timestamp}.md
   */
  private generateFilename(debate: DebateRecord): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `debate_v${debate.version}_${debate.domain}_${timestamp}.md`;
  }

  /**
   * 토론 로그를 마크다운 형식으로 변환
   */
  private formatDebateAsMarkdown(debate: DebateRecord): string {
    const lines: string[] = [];

    // 헤더
    lines.push(`# 토론 기록: ${debate.topic}`);
    lines.push('');
    lines.push(`- **ID**: ${debate.id}`);
    lines.push(`- **도메인**: ${debate.domain}`);
    lines.push(`- **팀**: ${debate.team}`);
    lines.push(`- **버전**: v${debate.version}`);
    lines.push(`- **시작 시간**: ${debate.startedAt.toISOString()}`);
    if (debate.completedAt) {
      lines.push(`- **완료 시간**: ${debate.completedAt.toISOString()}`);
    }
    lines.push(`- **현재 단계**: ${this.formatPhase(debate.currentPhase)}`);
    lines.push('');

    // 배경 데이터
    lines.push('## 배경 데이터 (Context)');
    lines.push('```json');
    lines.push(JSON.stringify(debate.contextData, null, 2));
    lines.push('```');
    lines.push('');

    // 정(Thesis) - 낙관론자
    if (debate.thesis) {
      lines.push('## 정(正) - 낙관론자 의견');
      lines.push(`**에이전트**: ${debate.thesis.agentId}`);
      lines.push(`**신뢰도**: ${debate.thesis.content.confidence}%`);
      lines.push('');
      lines.push('### C.A.T.S 명령');
      lines.push(`- **Context**: ${debate.thesis.catsCommand.context}`);
      lines.push(`- **Agent Role**: ${debate.thesis.catsCommand.agentRole}`);
      lines.push(`- **Task**: ${debate.thesis.catsCommand.task}`);
      lines.push(`- **Success Criteria**: ${debate.thesis.catsCommand.successCriteria}`);
      lines.push('');
      lines.push('### 입장');
      lines.push(debate.thesis.content.position);
      lines.push('');
      lines.push('### 추론');
      lines.push(debate.thesis.content.reasoning);
      lines.push('');
      if (debate.thesis.content.evidence?.length > 0) {
        lines.push('### 근거');
        debate.thesis.content.evidence.forEach((e, i) => {
          lines.push(`${i + 1}. ${JSON.stringify(e)}`);
        });
        lines.push('');
      }
    }

    // 반(Antithesis) - 비관론자
    if (debate.antithesis) {
      lines.push('## 반(反) - 비관론자 의견');
      lines.push(`**에이전트**: ${debate.antithesis.agentId}`);
      lines.push(`**신뢰도**: ${debate.antithesis.content.confidence}%`);
      lines.push('');
      lines.push('### C.A.T.S 명령');
      lines.push(`- **Context**: ${debate.antithesis.catsCommand.context}`);
      lines.push(`- **Agent Role**: ${debate.antithesis.catsCommand.agentRole}`);
      lines.push(`- **Task**: ${debate.antithesis.catsCommand.task}`);
      lines.push(`- **Success Criteria**: ${debate.antithesis.catsCommand.successCriteria}`);
      lines.push('');
      lines.push('### 입장');
      lines.push(debate.antithesis.content.position);
      lines.push('');
      lines.push('### 추론');
      lines.push(debate.antithesis.content.reasoning);
      lines.push('');
      if (debate.antithesis.content.evidence?.length > 0) {
        lines.push('### 근거');
        debate.antithesis.content.evidence.forEach((e, i) => {
          lines.push(`${i + 1}. ${JSON.stringify(e)}`);
        });
        lines.push('');
      }
    }

    // 합(Synthesis) - 중재자
    if (debate.synthesis) {
      lines.push('## 합(合) - 중재자 종합');
      lines.push(`**에이전트**: ${debate.synthesis.agentId}`);
      lines.push(`**신뢰도**: ${debate.synthesis.content.confidence}%`);
      lines.push('');
      lines.push('### C.A.T.S 명령');
      lines.push(`- **Context**: ${debate.synthesis.catsCommand.context}`);
      lines.push(`- **Agent Role**: ${debate.synthesis.catsCommand.agentRole}`);
      lines.push(`- **Task**: ${debate.synthesis.catsCommand.task}`);
      lines.push(`- **Success Criteria**: ${debate.synthesis.catsCommand.successCriteria}`);
      lines.push('');
      lines.push('### 종합 입장');
      lines.push(debate.synthesis.content.position);
      lines.push('');
      lines.push('### 추론');
      lines.push(debate.synthesis.content.reasoning);
      lines.push('');
      if (debate.synthesis.content.suggestedActions?.length) {
        lines.push('### 권고 조치');
        debate.synthesis.content.suggestedActions.forEach((a, i) => {
          lines.push(`${i + 1}. ${a}`);
        });
        lines.push('');
      }
    }

    // 최종 결정
    if (debate.finalDecision) {
      lines.push('## 최종 결정');
      lines.push(`**우선순위**: ${debate.finalDecision.priority}`);
      lines.push(`**신뢰도**: ${debate.finalDecision.confidence}%`);
      lines.push('');
      lines.push('### 권고사항');
      lines.push(debate.finalDecision.recommendation);
      lines.push('');
      lines.push('### 근거');
      lines.push(debate.finalDecision.reasoning);
      lines.push('');
      if (debate.finalDecision.dissent) {
        lines.push('### 소수 의견');
        lines.push(debate.finalDecision.dissent);
        lines.push('');
      }
      if (debate.finalDecision.actions.length > 0) {
        lines.push('### 실행 항목');
        debate.finalDecision.actions.forEach((a, i) => {
          lines.push(`${i + 1}. ${a}`);
        });
        lines.push('');
      }
    }

    // 거버넌스 검토
    if (debate.governanceReviews?.length) {
      lines.push('## 거버넌스 검토');
      debate.governanceReviews.forEach(review => {
        lines.push(`### ${review.reviewerId} 검토`);
        lines.push(`- **승인**: ${review.approved ? '✅ 승인됨' : '❌ 거부됨'}`);
        lines.push(`- **점수**: ${review.score}/100`);
        lines.push(`- **검토 시간**: ${review.timestamp.toISOString()}`);
        lines.push('');
        if (review.issues?.length) {
          lines.push('#### 발견된 이슈');
          review.issues.forEach((issue, i) => {
            lines.push(`${i + 1}. [${issue.severity}] ${issue.type}: ${issue.description}`);
          });
          lines.push('');
        }
        if (review.recommendations?.length) {
          lines.push('#### 권고사항');
          review.recommendations.forEach((r, i) => {
            lines.push(`${i + 1}. ${r}`);
          });
          lines.push('');
        }
      });
    }

    lines.push('---');
    lines.push(`*Generated at ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  private formatPhase(phase: DebatePhase): string {
    const phaseNames: Record<DebatePhase, string> = {
      pending: '대기중',
      thesis: '정(正) 진행중',
      antithesis: '반(反) 진행중',
      synthesis: '합(合) 진행중',
      governance_review: '거버넌스 검토중',
      complete: '완료',
    };
    return phaseNames[phase] || phase;
  }

  /**
   * 토론 로그 저장
   */
  async writeDebateLog(debate: DebateRecord): Promise<string> {
    const filename = this.generateFilename(debate);
    const filepath = path.join(this.wipPath, filename);
    const content = this.formatDebateAsMarkdown(debate);

    try {
      await fs.writeFile(filepath, content, 'utf-8');
      this.debateIndex.set(debate.id, filepath);
      console.log(`[WipManager] 토론 로그 저장: ${filename}`);
      return filepath;
    } catch (error) {
      console.error('[WipManager] 토론 로그 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 기존 토론 로그 업데이트
   */
  async updateDebateLog(debateId: string, debate: DebateRecord): Promise<string> {
    // 기존 파일 찾기
    const existingFiles = await this.findDebateFiles(debateId);

    // 기존 파일이 있으면 아카이브로 이동
    for (const file of existingFiles) {
      await this.archiveDebateLog(file);
    }

    // 새 로그 저장
    return await this.writeDebateLog(debate);
  }

  /**
   * 토론 ID로 파일 찾기 (인덱스 우선, fallback: 파일 스캔)
   */
  private async findDebateFiles(debateId: string): Promise<string[]> {
    // 인덱스에서 먼저 조회
    const indexed = this.debateIndex.get(debateId);
    if (indexed) {
      try {
        await fs.access(indexed);
        return [indexed];
      } catch {
        this.debateIndex.delete(debateId);
      }
    }

    // Fallback: 파일 스캔
    try {
      const files = await fs.readdir(this.wipPath);
      const matchingFiles: string[] = [];

      for (const file of files) {
        if (file.startsWith('debate_') && file.endsWith('.md')) {
          const filepath = path.join(this.wipPath, file);
          const content = await fs.readFile(filepath, 'utf-8');
          if (content.includes(`- **ID**: ${debateId}`)) {
            matchingFiles.push(filepath);
            this.debateIndex.set(debateId, filepath);
          }
        }
      }

      return matchingFiles;
    } catch {
      return [];
    }
  }

  /**
   * 토론 로그 읽기
   */
  async readDebateLog(debateId: string): Promise<string | null> {
    const files = await this.findDebateFiles(debateId);
    if (files.length === 0) return null;

    // 가장 최근 파일 반환
    const latestFile = files.sort().pop()!;
    return await fs.readFile(latestFile, 'utf-8');
  }

  /**
   * 토론 로그 아카이브
   */
  async archiveDebateLog(filepath: string): Promise<void> {
    const filename = path.basename(filepath);
    const archiveFilepath = path.join(this.archivePath, filename);

    try {
      await fs.rename(filepath, archiveFilepath);
      console.log(`[WipManager] 토론 로그 아카이브: ${filename}`);
    } catch (error) {
      console.error('[WipManager] 아카이브 실패:', error);
      throw error;
    }
  }

  /**
   * 모든 토론 로그 목록 조회
   */
  async listDebateLogs(): Promise<WipFileMetadata[]> {
    try {
      const files = await fs.readdir(this.wipPath);
      const metadata: WipFileMetadata[] = [];

      for (const file of files) {
        if (!file.startsWith('debate_') || !file.endsWith('.md')) continue;

        const filepath = path.join(this.wipPath, file);
        const stats = await fs.stat(filepath);
        const content = await fs.readFile(filepath, 'utf-8');

        // 파일명에서 정보 추출: debate_v{version}_{domain}_{timestamp}.md
        const match = file.match(/debate_v(\d+)_([^_]+)_(.+)\.md/);
        if (!match) continue;

        const [, version, domain] = match;

        // 내용에서 추가 정보 추출
        const debateIdMatch = content.match(/- \*\*ID\*\*: (.+)/);
        const teamMatch = content.match(/- \*\*팀\*\*: (.+)/);
        const phaseMatch = content.match(/- \*\*현재 단계\*\*: (.+)/);

        metadata.push({
          debateId: debateIdMatch?.[1] || 'unknown',
          version: parseInt(version),
          domain: domain as InsightDomain,
          team: (teamMatch?.[1] || 'unknown') as DomainTeam,
          filename: file,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
          phase: this.parsePhase(phaseMatch?.[1] || 'pending'),
        });
      }

      return metadata.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('[WipManager] 목록 조회 실패:', error);
      return [];
    }
  }

  private parsePhase(phaseText: string): DebatePhase {
    const phaseMap: Record<string, DebatePhase> = {
      대기중: 'pending',
      '정(正) 진행중': 'thesis',
      '반(反) 진행중': 'antithesis',
      '합(合) 진행중': 'synthesis',
      '거버넌스 검토중': 'governance_review',
      완료: 'complete',
    };
    return phaseMap[phaseText] || 'pending';
  }

  /**
   * 오래된 아카이브 정리 (30일 이상)
   */
  async cleanupOldArchives(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;

    try {
      const files = await fs.readdir(this.archivePath);

      for (const file of files) {
        const filepath = path.join(this.archivePath, file);
        const stats = await fs.stat(filepath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filepath);
          deletedCount++;
        }
      }

      console.log(`[WipManager] ${deletedCount}개의 오래된 아카이브 삭제됨`);
      return deletedCount;
    } catch (error) {
      console.error('[WipManager] 아카이브 정리 실패:', error);
      return deletedCount;
    }
  }
}
