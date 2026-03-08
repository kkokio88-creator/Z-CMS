# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Z-CMS is a React-based production analytics dashboard for waste and BOM (Bill of Materials) difference analysis. It integrates with ECOUNT ERP for real-time monitoring of inventory, profitability, and order management.

## Build & Development Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
```

## Tech Stack

- React 19 with TypeScript 5.8
- Vite 6 for build tooling
- Recharts for data visualization
- Tailwind CSS for styling
- ECOUNT ERP API integration
- Gemini API for AI insights

## Architecture

### State Management

- App.tsx serves as the root component managing global state via React hooks
- No routing library - view switching handled via `currentView` state in App.tsx
- Date range filtering (7days, 30days, month) affects all relevant data views
- ECOUNT config persisted in localStorage, session ID kept in memory

### Data Flow

1. `syncAllEcountData()` in App.tsx fetches all data on mount
2. `ecountService.ts` handles API calls with automatic session management
3. Raw ECOUNT responses transformed to typed interfaces
4. Data passed down to view components via props
5. Mock data fallback (in constants.ts) when API unavailable

### ECOUNT API Integration (services/ecountService.ts)

- `callEcountApi()` wrapper with automatic re-login on session expiry (error code "999")
- Parallel API calls for efficiency using Promise.all
- Endpoints: `/Login`, `/Sale/GetList`, `/Purchase/GetList`, `/Inventory/GetBalance`, `/Production/GetList`, `/BOM/GetList`
- Config stored in localStorage as `ECOUNT_CONFIG` with zone (default: "CD")

### View Components (components/)

- `DashboardHomeView.tsx` - Summary KPIs and trends
- `ChannelProfitView.tsx` - Daily profit analysis with CSV export
- `WasteBomView.tsx` - Waste tracking and BOM difference analysis with AI reasoning
- `InventorySafetyView.tsx` - Stock levels with emergency order capability
- `StocktakeAnomalyView.tsx` - Inventory count discrepancies with AI predictions
- `MonthlyProfitView.tsx` - Profit rankings and cost structure
- `OrderManagementView.tsx` - Purchase order suggestions with supplier contacts
- `SettingsView.tsx` - ECOUNT API configuration

### Type Definitions (types.ts)

Core entities: `ChannelProfitData`, `BomDiffItem`, `InventorySafetyItem`, `StocktakeAnomalyItem`, `ProfitRankItem`, `WasteTrendData`, `OrderSuggestion`, `Notification`

ECOUNT raw types: `EcountSaleRaw`, `EcountInventoryRaw`, `EcountProductionRaw`, `EcountBomRaw`, `EcountPurchaseRaw`

## Key Conventions

- All UI text is in Korean
- Dark mode support via Tailwind `dark:` prefix
- Status color coding: red=shortage, orange=warning, green=normal
- Material Design Icons referenced via `material-icons-outlined` class
- BOM diff items include `reasoning` field for AI-generated analysis
- Deterministic random generation using seed-based hashing for mock data consistency

## Design System
- **UI 프레임워크**: shadcn/ui (Radix UI + Tailwind CSS) — `src/components/ui/` 15개 프리미티브
- **아이콘**: Lucide React — `src/lib/icons.ts` (100+ 매핑), `DynamicIcon` 컴포넌트
- **테마**: CSS 변수 기반 HSL 컬러 시스템 (index.css)
- **유틸리티**: `cn()` (clsx + tailwind-merge) — `src/lib/utils.ts`
- **Material Icons**: 완전 제거 (CDN + 코드 모두 0건)

## Feature Development Workflow: Superpowers + Ralph Loop

모든 신규 기능 개발은 아래 2-Phase 프로세스를 따릅니다.

### Phase 1: Superpowers (기획 & 분석)

`/superpowers` 스킬을 사용하여 깊이 있는 기획을 수행합니다.

1. **코드베이스 분석** — 관련 모듈, 타입, 패턴 파악
2. **대안 탐색** — 3+ 구현 방안 비교, 트레이드오프 분석
3. **YAGNI 리뷰** — 과잉 설계 제거
4. **스토리 분해** — 의존성 순서로 원자적 유저 스토리 생성
5. **출력** — `ralph/plan-[feature].md` + `ralph/prd.json`

핵심 원칙:
- 각 스토리는 하나의 Ralph 이터레이션(하나의 컨텍스트 윈도우)에서 완료 가능해야 함
- 스토리 순서: 타입/스키마 → 서비스/로직 → UI → 통합
- 수용 기준은 검증 가능해야 함 (모호한 기준 금지)
- `notes` 필드에 파일 경로, 타입명, 구현 힌트를 반드시 포함

### Phase 2: Ralph Loop (자율 반복 실행)

`ralph/ralph.sh`로 자율 에이전트 루프를 실행합니다.

```bash
# 기본 실행 (최대 10회 반복)
./ralph/ralph.sh

# 옵션 지정
./ralph/ralph.sh --max 15 --delay 10 --verbose
```

Ralph Loop 특징:
- **이터레이션당 하나의 스토리** — 매 반복마다 새 컨텍스트
- **듀얼 종료 조건** — COMPLETE 시그널 + prd.json 검증 둘 다 확인
- **서킷 브레이커** — 3회 연속 진전 없으면 자동 중단
- **아카이브** — 브랜치 변경 시 이전 run 자동 보관
- **진행 파일** — `ralph/progress.txt`에 각 이터레이션 결과 기록

Ralph가 별도 터미널에서 실행 불가 시, 대화형 세션에서 직접 구현도 가능합니다.

### Ralph 디렉토리 구조

```
ralph/
├── CLAUDE.md        # Ralph 에이전트 프롬프트
├── ralph.sh         # 루프 스크립트 (v2)
├── prd.json         # 현재 PRD (유저 스토리)
├── progress.txt     # 진행 상황 로그
├── plan-*.md        # Superpowers 기획 문서
├── .last-branch     # 마지막 브랜치 추적
└── archive/         # 완료된 PRD 아카이브
```

### 관련 Skills

| Skill | 용도 |
|-------|------|
| `/superpowers` | 기획 & 브레인스토밍 (Phase 1) |
| `/ralph` | PRD → prd.json 변환 |
| `/prd` | PRD 마크다운 생성 |

## Multi-Agent Collaboration

### Team Structure

| 역할 | 모델 | tmux 위치 | 도구 | 책임 |
|------|------|-----------|------|------|
| **Leader** | Opus | window 0 "leader" | Superpowers, bkit(선택) | 전략 수립, 작업 분배, 품질 검토, 사용자 소통 |
| **Sub-agent** | Sonnet | window 1-N (동적) | Ralph Loop | 병렬 구현, 테스팅, 문서화 |

Leader 책임:
- 이 CLAUDE.md의 모든 규칙 준수
- 서브 에이전트에게 **필요한 컨텍스트만** 발췌 전달 (전체 CLAUDE.md 전달 금지)
- 최종 품질 검증 (`npx tsc --noEmit` + `npm run build`)

Sub-agent 책임:
- 할당된 태스크만 집중 (다른 작업 무관심)
- 완료 시 결과 파일 생성 후 자동 종료
- Leader의 피드백에 따라 재작업

### Mode Selection (단일 vs 멀티)

**멀티 에이전트 모드** — 아래 조건 모두 만족 시:
- 3개 이상의 독립적 하위 작업 존재
- 병렬 처리 가능 (의존성 낮음)
- 예상 소요 시간 30분 이상

Z-CMS 예시: 새 뷰 + insightService 함수 + 대시보드 카드 동시 개발

**단일 에이전트 모드** — 아래 중 하나라도 해당 시:
- 순차 처리 필요 (예: insightService 함수 추가 → 뷰에서 호출)
- 15분 이내 완료 가능
- 단일 파일 변경 (버그 수정, 설정 변경)

**복잡도 자동 판단**:
```
점수 = (하위작업 수 × 10) + (예상시간(분) × 1) + (병렬 가능 시 +30) + (의존성 높을 시 -50)
< 50점: 단일 모드 | >= 50점: 멀티 에이전트 모드
```

### Workflow Rules

1. 모든 태스크는 Leader가 분해하고 Sub-agent에 할당
2. Sub-agent는 완료 시 `.claude/results/{name}/DONE` 파일 생성
3. 파일 충돌 방지: `acquire-lock.sh`로 동일 파일 동시 수정 금지
4. 커밋은 Leader만 수행 (Sub-agent는 코드 변경만)
5. 비용 추정은 멀티 모드 전환 전 필수 (`cost-estimate.sh`)

### Multi-Agent Directory Structure

```
.claude/
├── scripts/
│   ├── init-agent-team.sh        # 팀 초기화 (tmux 세션 + 스냅샷)
│   ├── spawn-subagent.sh         # 서브 에이전트 생성
│   ├── terminate-subagent.sh     # 서브 에이전트 종료
│   ├── snapshot-context.sh       # CLAUDE.md 스냅샷 (버전 고정)
│   ├── acquire-lock.sh           # 파일 락 획득
│   ├── release-lock.sh           # 파일 락 해제
│   └── cost-estimate.sh          # 비용 추정
├── context/
│   ├── project-snapshot.md       # CLAUDE.md 스냅샷
│   ├── current-task.md           # 현재 작업 정의
│   └── decisions.log             # 의사결정 기록
├── handoffs/{agent-name}/
│   ├── assignment.md             # 작업 지시 (압축된 컨텍스트)
│   ├── context-extract.md        # 필요한 규칙만 발췌
│   └── feedback.md               # 피드백
├── results/{agent-name}/
│   ├── summary.md                # 작업 요약
│   ├── changes.txt               # 변경 파일 목록
│   ├── cost.txt                  # 실제 소요 비용
│   └── DONE                      # 완료 마커
└── locks/                        # 파일 락 디렉토리
```

### Multi-Agent Workflow

```
사용자 요청
    ↓
[Leader] CLAUDE.md 읽기 + 복잡도 판단
    ↓
점수 < 50 ──→ 단일 모드 (Superpowers → Ralph Loop)
    ↓
점수 >= 50
    ↓
[cost-estimate.sh] 비용 추정 + 사용자 승인
    ↓
[snapshot-context.sh] CLAUDE.md + Git 상태 스냅샷
    ↓
[init-agent-team.sh] tmux 세션 생성
    ↓
[spawn-subagent.sh × N] 서브 에이전트 생성 (최대 4개)
    ↓
병렬 실행 + 모니터링
├─ 각 Sub-agent: Ralph Loop로 자율 실행
├─ Leader: 30초마다 진행률 체크
├─ 에러 3회 반복 시 즉시 중단
└─ 파일 락으로 충돌 방지
    ↓
[Leader] 완료된 것부터 순차 검토
    ↓
피드백 필요? → feedback.md 작성 → 재작업
    ↓
통합 테스트: npx tsc --noEmit && npm run build
    ↓
[terminate-subagent.sh × N] 서브 에이전트 종료 + 아카이브
    ↓
비용 리포트 + 사용자 보고
```

### File-Based Collaboration Protocol

#### Leader → Sub-agent (Assignment)

경로: `.claude/handoffs/{agent-name}/assignment.md`

```markdown
# 작업: CostManagementView에 새 탭 추가

## 목표
BudgetExpenseView를 CostManagementView의 하위 탭으로 연결

## 입력 파일
- src/components/views/CostManagementView.tsx (수정 대상)
- src/components/views/BudgetExpenseView.tsx (참고)
- src/config/routeConfig.ts (수정 대상)

## 필수 프로젝트 규칙 (CLAUDE.md 발췌)
- UI 텍스트 한국어
- shadcn/ui 컴포넌트 사용, Lucide 아이콘
- SubTabLayout + children function 패턴
- cn() 유틸리티 (clsx + tailwind-merge)

## 수정 금지 파일
- src/types.ts (읽기만)
- src/services/insightService.ts (다른 에이전트 담당)

## 성공 기준
npx tsc --noEmit && npm run build

## 완료 시
1. .claude/results/{name}/summary.md 작성
2. .claude/results/{name}/DONE 파일 생성
```

**핵심**: 전체 CLAUDE.md 전달 금지, 이 작업에 필요한 규칙만 발췌, 20k 토큰 이내

#### Sub-agent → Leader (Result)

경로: `.claude/results/{agent-name}/summary.md`

```markdown
# 완료 보고: cost-tab-agent

## 완료 항목
- CostManagementView에 budgetExpense 탭 추가
- routeConfig.ts에 budget-expense path 추가
- 빈 상태 안내 메시지 포함

## 변경 파일
- src/components/views/CostManagementView.tsx (+25줄)
- src/config/routeConfig.ts (+1줄)

## 검증 결과
- npx tsc --noEmit: PASS
- npm run build: PASS (1m 02s)

## 소요: 12분, 반복 3회
```

### Cost Optimization

#### 비용 추정 (멀티 모드 전환 전 필수)

```bash
bash .claude/scripts/cost-estimate.sh 3 30
# 출력: Leader(Opus) + 3 Sub(Sonnet) × 30분 예상 비용
```

#### 비용 절감 전략

1. **최소 서브 에이전트**: 4개 이하, 순차 가능한 것은 하나로 통합
2. **컨텍스트 압축**: 필요한 규칙만 발췌, 20k 토큰 이내
3. **조기 종료**: 에러 3회 반복 시 즉시 중단, 비용 임계값 알림
4. **사전 시뮬레이션**: 단일 에이전트로 1차 실행 → 복잡도 확인 후 멀티 전환

### Scripts Quick Reference

| 스크립트 | 용도 | 사용 예시 |
|----------|------|-----------|
| `init-agent-team.sh` | tmux 세션 + 스냅샷 생성 | `bash .claude/scripts/init-agent-team.sh z-cms` |
| `spawn-subagent.sh` | 서브 에이전트 생성 | `bash .claude/scripts/spawn-subagent.sh view-agent "탭 추가"` |
| `terminate-subagent.sh` | 서브 에이전트 종료 | `bash .claude/scripts/terminate-subagent.sh view-agent` |
| `snapshot-context.sh` | 컨텍스트 스냅샷 | `bash .claude/scripts/snapshot-context.sh` |
| `acquire-lock.sh` | 파일 락 획득 | `bash .claude/scripts/acquire-lock.sh src/App.tsx agent-1` |
| `release-lock.sh` | 파일 락 해제 | `bash .claude/scripts/release-lock.sh src/App.tsx` |
| `cost-estimate.sh` | 비용 추정 | `bash .claude/scripts/cost-estimate.sh 3 30` |

## [Progress]

> 마지막 업데이트: 2026-02-26

### 현재 상태: Multi-Agent 워크플로우 구축 완료

- **종합 품질 점수**: ~80/100 (목표 80 달성)
- **계획 문서**: `docs/progress.md` 참조
- **Phase 0** (긴급 보안): ✅ 완료
- **Phase 1** (안정화): ✅ 완료
- **Phase 2** (프론트 리팩터링): ✅ 완료
- **Phase 3** (백엔드 개선): ✅ 완료 (13/13)
- **Phase 4** (UI/UX 고도화): ✅ 완료 (10/10)
- **Phase 5** (shadcn/ui 마이그레이션): ✅ 완료 — Material Icons 완전 제거, 15개 UI 프리미티브, 12개 뷰 + 20개 컴포넌트 전환
- **Phase 6** (뷰 데이터 연결): ✅ 완료 — GS 데이터 연동, 동적 공급처, 스냅샷 추이, 채널 수익 차트
- **Phase 7** (고아 뷰 활성화): ✅ 완료 — BomIntegrity/BudgetExpense 뷰 연결, 3개 인사이트 함수, 스켈레톤, 대시보드 카드
- **Phase 8** (운영 자동화): ✅ 완료 — Superpowers 기획 스킬 + Ralph Loop v2 (듀얼 종료, 서킷 브레이커)
- **Phase 9** (멀티 에이전트): ✅ 완료 — tmux 기반 Leader/Sub-agent 팀, 7개 스크립트, 파일 락, 비용 추정, 협업 프로토콜
