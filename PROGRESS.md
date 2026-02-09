# Z-CMS 비즈니스 설정 중앙 관리 고도화 - 진행 상태

## 작업 개요
비즈니스 설정의 중앙 관리 시스템 구축 및 프론트엔드 아키텍처 개선

---

## Phase 1: 비즈니스 설정 인프라 [완료]
- [x] `src/config/businessConfig.ts` — 30개 비즈니스 상수 중앙 관리
- [x] `src/contexts/SettingsContext.tsx` — useSettings() 훅, localStorage 연동
- [x] `src/contexts/DataContext.tsx` — 전역 데이터 상태 Context
- [x] `src/contexts/UIContext.tsx` — UI 상태 Context (뷰, 날짜범위, 다크모드)

## Phase 2: 컴포넌트 구현 [완료]
- [x] `src/components/ErrorBoundary.tsx` — 화면별 오류 격리
- [x] `src/components/ChannelCostAdmin.tsx` — 채널별 변동비/고정비 관리
- [x] `src/validation/schemas.ts` — Zod 검증 스키마

## Phase 3: 서비스 리팩토링 [완료]
- [x] `insightService.ts` — BusinessConfig 파라미터 적용
- [x] `costAnalysisService.ts` — BusinessConfig import 추가
- [x] `costManagementService.ts` — 조정
- [x] `ecountService.ts` — DEFAULT_CONFIG 인증정보 하드코딩 제거
- [x] `googleSheetService.ts` — 조정
- [x] `orderingService.ts` — erfInv/getZScore 개선

## Phase 4: App.tsx 통합 [완료]
- [x] SettingsProvider > DataProvider > UIProvider 래핑
- [x] ErrorBoundary 6개 뷰 모두 적용
- [x] computeAllInsights()에 businessConfig 파라미터 전달
- [x] IntegratedDataContext.tsx 삭제 (3-Context로 대체)
- [x] DataSourceStatus.tsx 삭제 (SettingsView에 통합)

## Phase 5: SettingsView 확장 [완료]
- [x] 원가 설정 UI (20+개 필드)
- [x] ABC-XYZ 분류 설정
- [x] 이상감지 임계값 설정
- [x] 노무비 설정
- [x] 발주 파라미터 설정
- [x] ChannelCostAdmin 컴포넌트 임베드

## Phase 6: Supabase 백엔드 확장 [완료]
- [x] SupabaseAdapter — channel_costs, agent_state 테이블 추가
- [x] SyncService — 동기화 로직 확장
- [x] supabase.routes — 라우트 확장
- [x] supabase-schema.sql — 스키마 업데이트

## Phase 7: 빌드 검증 [완료]
- [x] 프론트엔드 빌드 성공 (vite build)
- [x] 백엔드 빌드 성공 (tsc)
- [x] 삭제 파일 참조 없음 확인

## Phase 8: 런타임 검증 [완료]
- [x] 개발 서버 실행 확인 (port 4000 정상 시작)
- [x] 주요 모듈 트랜스파일/서빙 정상 확인 (App, SettingsContext, businessConfig, ErrorBoundary, ChannelCostAdmin, schemas)
- [x] 삭제 파일 참조 없음 재확인 (DataSourceStatus, IntegratedDataContext)

## Phase 9: 커밋 및 정리 [진행중]
- [ ] 변경사항 커밋
- [ ] MEMORY.md 최종 업데이트

---

## 빌드 상태
| 대상 | 상태 | 비고 |
|------|------|------|
| Frontend (vite build) | ✅ 성공 | 736 modules, 1019KB bundle |
| Backend (tsc) | ✅ 성공 | 에러 없음 |
| Dev Server | ✅ 정상 | port 4000, 모든 모듈 정상 서빙 |

## 파일 변경 요약
- **새 파일 7개**: businessConfig, 3 Contexts, ErrorBoundary, ChannelCostAdmin, schemas
- **수정 파일 8개**: App.tsx, SettingsView, 6 services
- **삭제 파일 2개**: DataSourceStatus, IntegratedDataContext
- **서버 수정 4개**: SupabaseAdapter, SyncService, routes, schema
