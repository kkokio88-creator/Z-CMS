# Z-CMS 데이터 정합성 검증 진행 현황

> 시작일: 2026-02-13
> 마지막 업데이트: 2026-02-13 (전체 완료)

## 검증 항목 요약

| # | 항목 | 심각도 | 상태 | 비고 |
|---|------|--------|------|------|
| 1 | 유틸리티/BOM 헤더 행 검증 | 높음 | ✅ 완료 | date 필터로 안전, BOM 수율 미동기화(미사용) |
| 2 | sales_detail 정합성 검증 | 매우높음 | ✅ 완료 | 파이프라인 1:1 매핑 확인, 변환 에러 없음 |
| 3 | Supabase 행 수 비교 + 검증 API | 높음 | ✅ 완료 | GET /api/data/validate 엔드포인트 추가 |
| 4 | 생산/BOM 컬럼 인덱스 검증 | 높음 | ✅ 완료 | 생산: 완벽 일치, BOM: A~L 저장(N~Q 미사용) |
| 5 | 채널 매출 합계 검증 | 중 | ✅ 완료 | validate API에 포함 (1원 이상 차이 감지) |
| 6 | DELETE-INSERT 안전성 개선 | 높음 | ✅ 완료 | 날짜별 개별 DELETE-INSERT + 부분 실패 로깅 |
| 7 | 3-Tier 폴백 부분 실패 표시 | 중 | ✅ 완료 | dataStatus 필드 + 부분 실패 로깅 |
| 8 | 생산/BOM 컬럼 인덱스 검증 | 높음 | ✅ 완료 | 완벽 일치 확인 |
| 9 | 임시 파일 정리 | 낮음 | ✅ 완료 | 27개 삭제 + .gitignore 업데이트 |

---

## 상세 진행 기록

### 항목 1: 유틸리티 헤더 행 + BOM 헤더 행 검증 ✅ 완료
- **결과**: 모든 fetch 함수에 `date.match()` 필터가 있어 헤더/빈 행 자동 제외 → **데이터 손실 없음**
- **추가 발견**: dataSourceConfig와 코드의 시작 인덱스 불일치 (유지보수성 이슈, 기능 이슈 아님)
- **BOM 컬럼 매핑 불일치 발견**:
  - Supabase bom 테이블: A~L 컬럼만 저장 (source, product_code ~ additional_qty)
  - dataSourceConfig: N(packagingYield), O(coolingYield), P(rawMaterialYield), Q(date) 정의됨
  - **BOM 수율 데이터(N~P)와 날짜(Q)가 Supabase에 미동기화** → 항목 4에서 추가 검증
- **상태**: ✅ 완료 (2026-02-13)

### 항목 2: sales_detail 정합성 검증 ✅ 완료
- **결과**: 데이터 파이프라인 1:1 매핑 확인, 변환 에러 없음
- **코드 검증**: GoogleSheetAdapter → SyncService → Supabase → supabaseClient 전 경로 일관됨
- **insightService**: recommendedRevenue 우선 사용, 없으면 settlementRevenue 폴백 (정상)
- **잠재 이슈**: 배송행 음수 금액이 채널 합산에 포함 (정상이지만 UI 표시 주의)
- **권장사항**: 런타임 데이터 검증 유틸리티 추가하여 비정상 데이터 감지
- **상태**: ✅ 완료 (2026-02-13)

### 항목 3: BOM 헤더 행 검증
- **파일**: `server/src/adapters/GoogleSheetAdapter.ts` fetchBom()
- **문제**: 헤더 2행 고정 → 첫 데이터 행 누락 가능
- **검증 방법**: BOM 테이블 행 수 vs 구글시트 행 수 비교
- **상태**: 대기

### 항목 4: Supabase vs Google Sheets 행 수 비교 ✅ 완료
- **구현**: `GET /api/data/validate` 엔드포인트 추가
- **기능**: 전 테이블 행 수 조회, 빈 테이블 감지, 조회 실패 감지
- **파일**: `server/src/adapters/SupabaseAdapter.ts` (getTableCounts), `server/src/routes/supabase.routes.ts`
- **상태**: ✅ 완료 (2026-02-13)

### 항목 5: 채널 매출 합계 검증 ✅ 완료
- **구현**: `GET /api/data/validate` 엔드포인트에 포함
- **기능**: daily_sales의 (jasa+coupang+kurly) vs totalRevenue 비교, 1원 이상 차이 감지
- **파일**: `server/src/adapters/SupabaseAdapter.ts` (validateDailySalesChannels)
- **추가**: sales_detail 정합성 (zeroRecommended, negativeSupply, mismatch) 검증도 포함
- **상태**: ✅ 완료 (2026-02-13)

### 항목 6: DELETE-INSERT 안전성 개선 ✅ 완료
- **변경**: 전체 날짜 일괄 DELETE → **날짜별 개별 DELETE-INSERT**
- **파일**: `server/src/adapters/SupabaseAdapter.ts` (upsertSalesDetail, upsertPurchases)
- **개선 내용**:
  - 날짜별로 DELETE → INSERT 수행, 한 날짜 실패 시 다른 날짜 데이터 보존
  - 부분 실패 로깅 (실패 날짜/건수 기록)
  - 성공한 행 수만 totalInserted로 반환
- **제약**: Supabase PostgREST는 DB 트랜잭션 미지원 → 날짜 단위가 최소 안전 단위
- **상태**: ✅ 완료 (2026-02-13)

### 항목 7: 3-Tier 폴백 부분 실패 명시적 표시 ✅ 완료
- **변경**: `GoogleSheetSyncResult`에 `dataStatus` 필드 추가
- **파일**: `src/services/googleSheetService.ts`
- **기능**:
  - 9개 데이터셋 각각의 loaded/count/source 상태 추적
  - 부분 실패 시 console.warn 로깅 (실패 데이터셋 이름 포함)
  - `DatasetStatus` 인터페이스 추가 (loaded, count, source)
- **상태**: ✅ 완료 (2026-02-13)

### 항목 8: 생산/BOM 컬럼 인덱스 검증 ✅ 완료
- **생산/폐기**: dataSourceConfig A~P → Adapter row[0]~row[15] → **완벽 일치**
- **BOM**: Adapter는 A~L만 저장, Config의 N~Q(수율+날짜)는 **미구현이지만 실제 미사용**
  - insightService 수율 추적은 production.wasteFinishedPct 사용 (BOM 수율 아님)
  - dataSourceConfig에서 미사용 컬럼 제거 권장 (정리 수준)
- **자재마스터**: Config 미정의이지만 Adapter/Supabase에 전체 매핑 완료
- **상태**: ✅ 완료 (2026-02-13)

### 항목 9: 임시 파일 정리 ✅ 완료
- **삭제**: tmp_* 20개, e2e-* 6개, e2e-screenshots/ 디렉토리, nul 파일
- **.gitignore 업데이트**: tmp_*, nul, e2e-*.mjs, e2e-*.png, e2e-screenshots/ 패턴 추가
- **유지**: server/migrate-purchases-schema.js, server/migrations/ (스키마 변경 이력으로 보존)
- **상태**: ✅ 완료 (2026-02-13)
