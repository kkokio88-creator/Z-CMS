# Z-CMS 기능 명세서

> **프로젝트**: Z-CMS (Zero-Waste Production Analytics Dashboard)
> **작성일**: 2026-02-08
> **Tech Stack**: React 19 + TypeScript 5.8 + Vite 6 (Frontend) / Express.js + TypeScript (Backend) / Supabase (DB)
> **총 코드량**: Frontend ~6,000줄 / Services ~5,100줄 / Backend ~9,400줄

---

## 목차

1. [데이터 동기화 및 통합](#1-데이터-동기화-및-통합)
2. [대시보드 홈](#2-대시보드-홈)
3. [수익 분석](#3-수익-분석)
4. [원가 관리](#4-원가-관리)
5. [생산/BOM 분석](#5-생산bom-분석)
6. [재고/발주 관리](#6-재고발주-관리)
7. [설정 관리](#7-설정-관리)
8. [AI 멀티에이전트 시스템](#8-ai-멀티에이전트-시스템)
9. [인사이트 엔진](#9-인사이트-엔진)
10. [통계적 발주 시스템](#10-통계적-발주-시스템)

---

## 1. 데이터 동기화 및 통합

### 1.1 3-Tier 폴백 데이터 동기화

| 항목 | 내용 |
|------|------|
| **기능명** | 3-Tier Fallback 데이터 동기화 |
| **위치** | `src/services/googleSheetService.ts`, `src/services/supabaseClient.ts` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | - | 마운트 시 자동 호출 (수동 트리거 가능) |
| 출력 | `GoogleSheetSyncResult` | dailySales, salesDetail, production, purchases, utilities, profitTrend, wasteTrend 등 11개 데이터셋 |

**처리 로직 요약**

```
1. checkDataSource() → 'backend' | 'direct' | false 판별
2. syncAllEcountData() + syncGoogleSheetData() 병렬 실행 (Promise.all)
3. 각 개별 fetch 함수(fetchDailySales 등)에 3-Tier 폴백 내장:
   - Tier 1: Supabase 직접 조회 (isSupabaseDirectAvailable 확인)
   - Tier 2: 백엔드 API /api/data/* (5초 타임아웃)
   - Tier 3: 레거시 백엔드 /api/googlesheet/sync
4. 백엔드 사용 가능 시 POST /api/sync/google-sheets 백그라운드 트리거 (fire-and-forget)
5. 데이터 수신 후 파생 데이터 생성: profitTrend, wasteTrend, purchaseSummary 등
6. computeAllInsights()로 10개 분석 인사이트 계산
7. dashboardSummary KPI 계산 (총매출, 평균마진, 위험품목수 등)
```

**현재 한계점**

- 마운트 시 1회만 동기화, 주기적 폴링 없음 (수동 새로고침 필요)
- `.catch(e => null)`로 에러를 삼킴 — 에러/데이터없음 구분 불가
- 요청 중복 방지(deduplication) 없음
- 대규모 데이터셋에 대한 페이지네이션 미지원
- 3-Tier 중 하나가 느리면 전체가 지연됨

---

### 1.2 백엔드 Supabase 동기화 서비스

| 항목 | 내용 |
|------|------|
| **기능명** | Google Sheets/ECOUNT → Supabase 자동 동기화 |
| **위치** | `server/src/services/SyncService.ts`, `server/src/adapters/SupabaseAdapter.ts` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | Google Sheets 5개 시트, ECOUNT 5개 엔드포인트 | 외부 데이터 소스 |
| 출력 | `SyncResult` | source, success, records(테이블별 건수), duration |

**처리 로직 요약**

```
1. 서버 시작 5초 후 초기 동기화 (3회 재시도, 10초 간격)
2. 이후 60분 간격 자동 동기화
3. syncFromGoogleSheets():
   - GoogleSheetAdapter로 5개 시트 fetch
   - Supabase 행 포맷으로 변환
   - 7개 테이블에 UPSERT (date 기반 UNIQUE)
   - sync_log 테이블에 감사 기록
4. syncFromEcount():
   - EcountAdapter로 5개 API 병렬 호출
   - 변환 후 UPSERT
```

**현재 한계점**

- 증분 동기화(delta sync) 미지원 — 항상 전체 데이터 fetch
- 트랜잭션 미지원 — 부분 실패 시 DB 불일치 가능
- sales_detail, purchases 테이블은 append-only — 중복 가능
- 삭제된 데이터 처리 안 됨 (소프트 딜리트 없음)
- 데이터 유효성 검증 없이 원본 그대로 INSERT

---

### 1.3 ECOUNT ERP 연동

| 항목 | 내용 |
|------|------|
| **기능명** | ECOUNT ERP API 통합 |
| **위치** | `src/services/ecountService.ts` (프론트), `server/src/adapters/EcountAdapter.ts` (백엔드) |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | `EcountConfig` | COM_CODE, USER_ID, API_KEY, ZONE |
| 출력 | `SyncResult` | inventory, anomalies, suggestions, bomItems, profitTrend, dataAvailability |

**처리 로직 요약**

```
1. 프론트엔드에서 POST /ecount/config로 설정 전달
2. 백엔드 EcountAdapter:
   - login() → SESSION_ID 획득
   - Error 999 자동 감지 → re-login + retry
   - 5개 API 병렬 호출: Sale, Purchase, Inventory, Production, BOM
   - 각 API에 3단계 fallback URL (예: /GetList → /ListV2 → /GetBalance)
3. 응답 데이터를 프론트엔드 타입으로 변환 (transformEcountData)
4. DataAvailability 플래그로 API별 성공/실패 추적
```

**현재 한계점**

- API 키가 소스코드에 하드코딩 (DEFAULT_CONFIG) — 보안 위험
- 설정 업데이트가 fire-and-forget (실패해도 무시)
- 단일 ZONE만 지원
- PageSize 최대 5,000건 — 초과 시 데이터 누락
- 요청 중복 방지 없음

---

### 1.4 Google Sheets 동적 연결

| 항목 | 내용 |
|------|------|
| **기능명** | Google Sheets 스프레드시트 동적 설정 및 데이터 조회 |
| **위치** | `server/src/routes/sheets.routes.ts`, `src/services/dataIntegrationService.ts` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | spreadsheetUrl, sheetName | Google Sheets URL 및 시트명 |
| 출력 | `Record<string, any>[]` | 헤더 기반 key-value 배열 |

**처리 로직 요약**

```
1. POST /api/sheets/test-connection: URL 유효성 + 권한 확인
2. POST /api/sheets/fetch-data: 전체 데이터 반환 (헤더 행 → 키)
3. 프론트엔드 dataIntegrationService:
   - 7개 데이터소스 병렬 fetch (Promise.all)
   - 유연한 컬럼 매핑: 한국어/영어 헤더 모두 인식 (날짜|일자|date 등)
   - transform 함수로 타입 안전 객체 변환
   - 누락 행 자동 스킵
```

**현재 한계점**

- 퍼지 컬럼 매칭으로 비표준 헤더 시 오인식 가능
- 설정된 소스와 무관하게 7개 전부 fetch (비효율)
- extractSpreadsheetId() 정규식이 특수 URL에서 실패 가능
- 재시도 로직 없음

---

## 2. 대시보드 홈

| 항목 | 내용 |
|------|------|
| **기능명** | 대시보드 홈 뷰 (KPI 요약 + 시스템 상태) |
| **위치** | `src/components/DashboardHomeView.tsx` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력(Props) | `summaryData`, `profitTrend`, `wasteTrend`, `dataAvailability`, `syncStatus`, `dataSource` 등 12개 props | App.tsx에서 전달 |
| 출력 | UI | KPI 카드, 데이터 소스 상태, 동기화 상태, 퀵 네비게이션 |

**처리 로직 요약**

```
1. KPI 카드 4개 표시: 총매출(억원), 평균마진(%), 평균폐기율(%), 위험품목수
2. 데이터 가용성 표시: 5개 ECOUNT API 각각 초록/회색 원형 아이콘
3. 데이터 소스 상태: Backend(초록) / Supabase Direct(노랑) / Offline(빨강)
4. 동기화 메시지: 레코드 수 + 소스 표시
5. 퀵 액션 버튼: 재고주문, AI모델학습, 월간리포트, 설정이동
6. Mini 스파크라인 차트: 매출/폐기 트렌드 배경
```

**현재 한계점**

- 스파크라인 차트에 mock 데이터 사용 (실데이터가 아닌 더미 트렌드)
- 퀵 액션 중 AI모델학습, 월간리포트 미구현 (클릭해도 동작 없음)
- Google Sheets 설정 조회 미완성
- 완전히 props 기반 — 자체 데이터 fetch 없음

---

## 3. 수익 분석

| 항목 | 내용 |
|------|------|
| **기능명** | 수익 분석 뷰 (3개 서브탭) |
| **위치** | `src/components/ProfitAnalysisView.tsx` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력(Props) | `dailySales`, `salesDetail`, `insights` (DashboardInsights) | 전역 상태에서 전달 |
| 출력 | UI | 채널별 수익, 품목별 랭킹, 수익 트렌드 |

### 3.1 채널별 수익

**처리 로직 요약**

```
1. insights.channelRevenue 데이터 소비
2. KPI 카드 3개: 채널별(자사몰/쿠팡/컬리) 매출 + 점유율
3. 일별 채널 Stacked Bar 차트: X축(날짜 M/D), Y축(매출, formatAxisKRW)
4. 채널 점유율 도넛 파이 차트
```

### 3.2 품목별 랭킹

**처리 로직 요약**

```
1. insights.productProfit 데이터 소비
2. KPI 카드: 총 품목수, 1위 품목명+매출, 총매출
3. Top 7 수평 바 차트 (매출 내림차순, 랭크별 그라데이션 색상)
4. Bottom 7 수평 바 차트 (빨간색 고정)
5. 20행 랭킹 테이블: 순위, 품목명, 매출, 비용, 마진, 마진율
6. 행 클릭 → 상세 모달 (원가구성 도넛 + 채널믹스 바 차트)
```

### 3.3 수익 트렌드

**처리 로직 요약**

```
1. insights.revenueTrend 데이터 소비
2. KPI 카드: 최근월 매출, 전월대비 변화율, 데이터 기간
3. 월별 이중축 라인 차트: 좌축(매출+이익), 우축(마진율%)
4. 월별 요약 테이블: 월, 매출, 이익, 마진율, 전월대비
```

**현재 한계점 (수익 분석 전체)**

- 이익 마진 30% 하드코딩 (실제 원가 기반 계산 아님)
- 차트 로딩 상태 없음
- 테이블 정렬/필터 미지원
- 차트→상세 드릴다운 불가
- 서브탭 상태가 부모 리마운트 시 초기화됨

---

## 4. 원가 관리

| 항목 | 내용 |
|------|------|
| **기능명** | 원가 관리 뷰 (5개 서브탭) |
| **위치** | `src/components/CostManagementView.tsx` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력(Props) | `purchases`, `utilities`, `production`, `insights` | 전역 상태 |
| 출력 | UI | 원가총괄, 원재료, 부재료, 노무비, 경비 분석 |

### 4.1 원가 총괄

**처리 로직 요약**

```
1. insights.costBreakdown.composition 데이터
2. KPI 카드: 총원가, 원재료 비중, 전월대비 변동
3. 월별 4요소 Stacked Area 차트: 원재료/부재료/노무비/경비
4. 원가 구성비 도넛 파이 차트 (4개 슬라이스, % 표시)
5. InsightCards: 상위 3개 비용절감 권고 (우선도 배지 + 예상 절감액)
```

### 4.2 원재료 분석

**처리 로직 요약**

```
상태: rawFilter = 'all' | '상승' | '하락' | '상위10'
1. 필터 버튼바: 전체/단가상승/단가하락/상위10
2. KPI 카드: 총 원재료 비용, 10%↑ 품목수, 필터 결과 수
3. 월별 원재료 비용 바 차트
4. 필터 결과 수평 바 차트 (품목별 총 지출)
5. 20행 단가 테이블: 품목명, 현재단가, 평균단가, 단가변동%, 총액
6. 행 클릭 → 해당 원재료의 가격 이력 라인 차트 표시
```

### 4.3 부재료 분석

**처리 로직 요약**

```
상태: subFilter = 'all' | '상위5'
- 원재료와 유사 구조 (간소화)
- 부재료 분류: SUB_MATERIAL_KEYWORDS 키워드 매칭
  ('포장', '박스', '비닐', '라벨', '테이프', '봉투', '스티커', '밴드', '용기', '캡', '뚜껑')
```

### 4.4 노무비

**처리 로직 요약**

```
1. KPI 카드: 추정 노무비, 월평균
2. 월별 노무비 바 차트
3. 월별 노무비 테이블: 월, 금액, 총원가 대비 비율
4. 노란색 경고 배너: "급여 데이터가 연동되지 않아 추정값입니다"
5. 노무비 = (원재료 + 부재료 + 경비) × 25% (추정)
```

### 4.5 경비

**처리 로직 요약**

```
상태: overheadFilter = 'all' | '전기' | '수도' | '가스'
1. 필터: 전체/전기/수도/가스
2. KPI 카드: 총경비, 유틸리티 합계, 기타 간접비, 단위당 에너지 비용
3. 유틸리티 차트: 전체→Stacked Area(3개), 단일→Bar
4. 단위 에너지 비용 라인 차트
5. 월별 유틸리티 테이블 (필터에 따라 컬럼 동적 변경)
```

**현재 한계점 (원가 관리 전체)**

- 노무비 하드코딩 추정 (실제 급여 시스템 연동 없음)
- 부재료 분류가 제품명 키워드 기반 — 영문/비표준 명칭 누락 가능
- 필터 상태가 서브탭 전환 시 초기화
- 기간 비교(YoY) 기능 없음
- 축 포맷이 대규모 수치 전제 — 소규모 비용 시 표시 비정상

---

## 5. 생산/BOM 분석

| 항목 | 내용 |
|------|------|
| **기능명** | 생산 현황 및 BOM 분석 뷰 (3개 서브탭) |
| **위치** | `src/components/ProductionBomView.tsx` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력(Props) | `production` (ProductionData[]), `insights` | 전역 상태 |
| 출력 | UI | 생산현황, 폐기분석, 생산성분석 |

### 5.1 생산 현황

**처리 로직 요약**

```
상태: prodFilter = 'all' | 'normal' | 'preprocess' | 'frozen' | 'sauce' | 'bibimbap'

1. 카테고리 필터바: 6개 색상 코딩 버튼
   - 전체(회색), 일반(파랑), 전처리(초록), 냉동(노랑), 소스(빨강), 비빔밥(보라)
2. KPI 카드: 총 생산량(formatQty), 일평균, 데이터 기간
3. 일별→주간 집계 (useMemo):
   - 월요일 기준 주 시작
   - 카테고리별 합산 → weekLabel, normal, preprocess, ...
4. 차트: 전체→Stacked Area(5개 시리즈), 단일→Bar
5. 카테고리 비율 도넛 파이
6. 단일 필터 시 일별 상세 테이블 (30행)
```

### 5.2 폐기 분석

**처리 로직 요약**

```
1. insights.wasteAnalysis 데이터 소비
2. KPI 카드:
   - 평균 폐기율 (2.5% 초과→빨강, 이하→초록)
   - 3% 초과일수 (빨강 배지)
   - 추정 폐기 비용 (EA × ₩1,000)
3. 주간 폐기 트렌드 이중축 차트: 좌축(생산량 바), 우축(폐기율% 라인)
4. 고폐기일 테이블: 날짜, 폐기율, 폐기량, 추정비용 (폐기율 내림차순)
```

### 5.3 생산성 분석

**처리 로직 요약**

```
상태: effFilter (카테고리 필터)
1. 카테고리 필터바 (생산현황과 동일)
2. KPI 카드: 최고 생산일(날짜+수량), 일평균, 활성 카테고리 수
3. 주간 생산 차트: 전체→Multi-Line(5개), 단일→Single Line
4. 카테고리 통계 테이블: 색상 인디케이터, 카테고리명, 총생산, 일평균, 최대일, 최대일자
5. 단일 필터 시 일별 상세 테이블 (30행)
```

**현재 한계점 (생산/BOM 전체)**

- 주간 집계 로직 하드코딩 (불완전 주 처리 미흡)
- 카테고리 필터 로직이 두 탭에 중복
- 폐기 비용 EA당 ₩1,000 하드코딩 (비현실적)
- 생산 리포트 내보내기 기능 없음
- 연간 비교(YoY) 불가
- ECOUNT 데이터 없을 시 폐기 데이터에서 합성 BOM 생성 (단순화된 모델)

---

## 6. 재고/발주 관리

| 항목 | 내용 |
|------|------|
| **기능명** | 재고 및 발주 관리 뷰 (4개 서브탭) |
| **위치** | `src/components/InventoryOrderView.tsx` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력(Props) | `inventoryData`, `purchases`, `insights`, `stocktakeAnomalies` | 전역 상태 |
| 출력 | UI | 재고현황, 이상징후, 통계적발주, 발주분석 |

### 6.1 재고 현황

**처리 로직 요약**

```
1. KPI 카드: 부족 품목수(빨강), 과잉 품목수(노랑), 정상 품목수(초록)
2. 위험 품목 수평 바 차트:
   - status !== 'Normal' 항목만 표시
   - Reference Line: 안전재고 수준
   - 부족=빨강, 과잉=주황
3. 위험 품목 테이블: 품목명, 상태배지, 현재고, 안전재고, 변동율%
4. 행 클릭 → 재고 이력 모달 (Area 차트 + 긴급발주 버튼)
```

### 6.2 이상징후 분석

**처리 로직 요약**

```
1. stocktakeAnomalies 데이터 소비 (anomalyScore 내림차순)
2. KPI 카드: 총 이상징후 수, 고위험(score≥70), 평균 점수
3. 이상징후 테이블:
   - 자재명, 위치, 시스템수량, 실사수량, 차이
   - AI 예측수량, 이상점수(배지: ≥80 빨강, ≥60 주황, <60 노랑)
   - 사유: 입고누락 / 과잉재고 / 분실
4. 행 클릭 → 이력 분석 모달 (편차 Bar 차트)
```

### 6.3 통계적 발주

**처리 로직 요약**

```
상태: serviceLevel(90/95/97/99%), orderDate, orderModal

1. 서비스 수준 버튼 그룹: 90%/95%/97%/99%
   - Z-Score 매핑: 90→1.28, 95→1.65, 97→1.88, 99→2.33
2. 주문 날짜 선택기
3. KPI 카드: 발주 필요 품목수, 긴급 품목수(stock < ROP), 부족 품목수
4. 재고일수 수평 바 차트 (상태별 색상)
5. 발주 분석 테이블 (50행):
   - 품목명, 상태배지, 발주처 (해시 기반 결정적 할당)
   - 발주방법 아이콘 (이메일/카카오/이카운트/전화/팩스)
   - 현재고, ROP, 안전재고, 재고일수
   - 제안수량, 입고예정일 (영업일 기준), [발주하기] 버튼
6. ROP 공식 참조 박스: Z-score, ROP, EOQ 공식 표시
7. 발주 버튼 클릭 → OrderModal:
   - 발주처 상세 (이름, 연락처)
   - 품목, 수량, 단가, 총액
   - 예상 입고일
   - [확인]/[취소]

공식:
  SafetyStock = Z × σ × √L
  ROP = avgDaily × L + SafetyStock
  EOQ = √(2DS/H) (D=연간수요, S=₩50,000, H=단가×20%)
```

### 6.4 발주 분석

**처리 로직 요약**

```
1. purchases 데이터 집계
2. KPI 카드: 총 구매액, 고유 품목수, 저회전 품목수(turnover < 1)
3. 상위 10 품목 수평 바 차트
4. 월별 구매 트렌드 라인 차트
5. 저회전 품목 테이블 (조건부 표시): 품목, 회전율, 현재고, 최종일자
6. 최근 구매 테이블 (15행): 날짜, 품목, 수량, 단가, 금액
```

**현재 한계점 (재고/발주 전체)**

- 발주처 데이터 전체 mock (해시 함수 기반 가상 할당)
- 발주 확인 시 alert만 표시 — 실제 API 호출 없음
- 리드타임이 범위 값 (발주처별 특정값 아님)
- 진행 중인 주문 반영 안 됨
- 이상 점수가 정적 (실시간 AI 아님)
- 다중 창고/로케이션 추적 불가
- Z-Score 테이블에 4개 값만 있음 (90, 95, 97, 99%)

---

## 7. 설정 관리

| 항목 | 내용 |
|------|------|
| **기능명** | 시스템 설정 뷰 |
| **위치** | `src/components/SettingsView.tsx` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | localStorage (ECOUNT_CONFIG, ZCMS_DATASOURCE_CONFIG) | 브라우저 저장소 |
| 출력 | UI | ECOUNT 설정, 데이터소스 관리, AI 설정, 재고/원가 기준 |

**처리 로직 요약**

```
섹션 1: ECOUNT API 연결 설정
  - 회사코드, 사용자ID, API키(password), Zone 선택(CD/AA/AB/BA)
  - [저장 & 테스트] → updateEcountConfig() + testApiConnection()
  - 결과 배지: 성공(초록) / 실패(빨강)

섹션 2: 데이터 소스 연결 관리
  - 7개 소스 카드: mealPlan, salesHistory, bomSan, bomZip, inventory, purchaseOrders, purchaseHistory
  - 각 소스: 타입 토글(Google Sheets / ECOUNT), URL/시트명 입력, [테스트] 버튼
  - 연결 상태: connected(초록), disconnected(회색), error(빨강), testing(파랑 회전)
  - 서비스 어카운트 이메일 표시 + 복사 버튼

섹션 3: AI 이상탐지 설정
  - 민감도 슬라이더 (0-100%, 권장 75-85%)
  - 자동 BOM 학습 토글

섹션 4: 재고 및 원가 기준
  - 안전 재고 일수 (기본 14일)
  - 저마진 경고 임계값 (기본 10%)

저장: 모든 설정 localStorage에 즉시 영속화
```

**현재 한계점**

- API 키 형식/URL 패턴 유효성 검증 없음
- 테스트 연결 URL이 `http://localhost:4001` 하드코딩
- AI 민감도, 마진 경고, 안전일수 설정값이 실제 로직에 미적용
- 브라우저 탭 간 설정 동기화 안 됨
- 설정 내보내기/백업 불가
- 리셋 시 확인 없이 즉시 삭제

---

## 8. AI 멀티에이전트 시스템

| 항목 | 내용 |
|------|------|
| **기능명** | 변증법적 토론 기반 AI 멀티에이전트 시스템 |
| **위치** | `server/src/services/DebateManager.ts`, `server/src/services/EventBus.ts`, `server/src/services/StateManager.ts` 등 |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | 토론 주제, contextData, priority | API 또는 자동 트리거 |
| 출력 | `DebateRecord` | thesis/antithesis/synthesis + governanceReviews + finalDecision |

**처리 로직 요약**

```
에이전트 계층 (20개):
  Tier 1 - 레거시 (5): Coordinator, BomWaste, Inventory, Profitability, CostManagement
  Tier 2 - Trio 팀 (12): 4개 도메인 × (Optimist + Pessimist + Mediator)
  Tier 3 - 거버넌스 (2): QASpecialist, ComplianceAuditor
  Tier 4 - 오케스트레이션 (1): ChiefOrchestrator

토론 흐름 (변증법):
  1. thesis (正)    → Optimist가 긍정적 시나리오 제안 (신뢰도, 근거 포함)
  2. antithesis (反) → Pessimist가 리스크/반론 제시
  3. synthesis (合)  → Mediator가 양측 종합하여 합의안 도출
  4. complete        → 최종 결정 + 거버넌스 리뷰 (QA + Compliance)

메시징: EventBus (EventEmitter3, 1000건 이력)
  - 13개 메시지 타입: TASK_ASSIGNMENT, INSIGHT_SHARE, DEBATE_THESIS, GOVERNANCE_REVIEW 등
  - Pub/Sub 패턴: subscribeAgent(), subscribeType(), subscribeAll()

상태 관리: StateManager (4개 도메인)
  - BomWaste: bomItems, wasteTrend
  - Inventory: inventoryItems, anomalies, orderSuggestions
  - Profitability: profitTrend, topProfit, bottomProfit
  - General: insights

토론 관리:
  - 동시 토론 최대 10개 (초과 시 큐 대기)
  - 토론 이력 최대 100건 (인메모리)
  - WipManager가 토론 기록을 마크다운 파일로 저장 (./wip/)

실시간 스트리밍 (SSE):
  - GET /api/stream: insight_share, state_sync, task_result 이벤트
  - 30초 heartbeat
  - 클라이언트 자동 정리 (disconnect)
```

**현재 한계점**

- 모든 에이전트 상태가 인메모리 — 서버 재시작 시 유실
- 분산 에이전트 미지원 (단일 서버)
- 토론 단계가 순차적 (병렬화 불가)
- SSE 자동 재연결 없음
- 콜백 미정리 시 메모리 누수 위험
- maxActiveDebates(10), history(100) 하드코딩 — 설정 변경 불가
- WIP 폴더가 로컬 파일시스템 — 수평 확장 시 공유 불가
- 에이전트 크래시 자동 복구 없음

---

## 9. 인사이트 엔진

| 항목 | 내용 |
|------|------|
| **기능명** | Supabase 실데이터 기반 분석 엔진 |
| **위치** | `src/services/insightService.ts` (866줄) |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | dailySales[], salesDetail[], production[], purchases[], utilities[], inventoryData[] | 동기화된 원시 데이터 |
| 출력 | `DashboardInsights` | 10개 인사이트 + recommendations[] |

**처리 로직 요약**

```
computeAllInsights() — 마스터 함수, 10개 compute 호출:

1. computeChannelRevenue(dailySales)
   - 채널별(자사/쿠팡/컬리) 매출 집계 + 점유율 계산
   - 일별 트렌드 반환

2. computeProductProfit(salesDetail, purchases)
   - productCode별 매출/비용 집계
   - margin = revenue - cost, marginRate = (margin/revenue)×100
   - 매출 내림차순 정렬

3. computeRevenueTrend(dailySales)
   - YYYY-MM 기준 월별 그룹핑
   - profit = revenue × 0.3 (하드코딩)
   - 전월대비 변화율 계산

4. computeMaterialPrices(purchases)
   - productCode별 가격 이력 추적
   - avgPrice = 총지출 / 총수량
   - changeRate = (현재가 - 초기가) / 초기가 × 100
   - |changeRate| 내림차순 정렬

5. computeUtilityCosts(utilities, production)
   - 월별 전기/수도/가스 + 총합
   - perUnit = 총비용 / 생산량

6. computeWasteAnalysis(production)
   - 일별 폐기율, 폐기량, 추정비용(EA × ₩1,000)
   - 고폐기일(>3%) 필터
   - 평균 폐기율 계산

7. computeProductionEfficiency(production)
   - 5개 카테고리별 total/avg/max/maxDate
   - 데이터 범위(from/to/days) 계산

8. computeCostBreakdown(purchases, utilities, production)
   - SUB_MATERIAL_KEYWORDS로 원/부재료 분류
   - 노무비 = (원재료+부재료+경비) × 25%
   - 경비 = 유틸리티 + (구매액 × 5%)
   - 월별 4요소 분해 + 구성비

9. computeStatisticalOrder(inventoryData, purchases, serviceLevel=95)
   - 일별 수요량 계산 (0일 포함)
   - SafetyStock = Z × σ × √L
   - ROP = avgDaily × L + SafetyStock
   - EOQ = √(2DS/H) (S=₩50,000, H=단가×20%)
   - 상태 결정: shortage(재고≤0 or <SS×0.5), urgent(<ROP), normal, overstock(>60일)

10. generateRecommendations(materialPrices, wasteAnalysis, utilityCosts, productProfit)
    - Rule 1: 원재료 단가 10%↑ → 절감 권고
    - Rule 2: 3%↑ 폐기일 발생 → 폐기 절감
    - Rule 3: 단위 에너지 비용 증가 → 에너지 절감
    - Rule 4: 저마진(<20%) 품목 → 마진 개선
    - 우선도 + 예상절감액 내림차순 정렬
```

**현재 한계점**

- 이익 마진 30% 하드코딩 (computeRevenueTrend)
- 노무비 25% 추정, 경비 5% 추정
- 폐기 비용 EA당 ₩1,000 고정
- Z-Score 4개 값만 지원
- EOQ가 상수 수요 가정 (계절성 무시)
- 표준편차에 0일(무주문일) 포함 — 수요 과소평가 가능
- 캐싱 없음 — 매 호출 시 전체 재계산

---

## 10. 통계적 발주 시스템

| 항목 | 내용 |
|------|------|
| **기능명** | MRP 기반 통계적 발주 자동화 |
| **위치** | `server/src/services/StatisticalOrderingService.ts`, `src/services/orderingService.ts` |

**입력/출력**

| 구분 | 타입 | 설명 |
|------|------|------|
| 입력 | 식단표, 판매이력(4주), 레시피(BOM), 식자재마스터, 현재고, 미입고주문 | 6개 데이터소스 |
| 출력 | `OrderRecommendation` | items[](발주 항목별 계산), totalEstimatedCost, serviceLevel |

**처리 로직 요약**

```
MRP 계산 10단계:

1. 식단표 로딩: D+0 ~ D+리드타임 기간의 메뉴 × 수량
2. 수요 예측: 요일별 판매 통계 (4주 이력) × 식단 계획
3. BOM 전개: 메뉴 수량 × 레시피 소요량 → 식자재별 총 소요량
4. 총 소요량 = Σ(모든 메뉴의 해당 식자재 소요)
5. 안전재고 = Z(1.65) × σ(수요 표준편차) × √L(리드타임일)
6. 총 필요량 = 총소요량 + 안전재고
7. 가용재고 = 현재고 + 미입고주문
8. 순 소요량 = max(0, 총필요량 - 가용재고)
9. 발주수량 = max(순소요량, MOQ)  // 최소발주수량 존중
10. 예상금액 = 발주수량 × 단가

API 엔드포인트:
  GET  /api/ordering/recommendation → 전체 발주 권고
  GET  /api/ordering/sales-stats    → 요일별 수요 통계
  POST /api/ordering/simulate       → What-if 시뮬레이션 (서비스수준/주수/추가수요 변경)
  GET  /api/ordering/config         → 발주 설정 조회
  PUT  /api/ordering/config         → 발주 설정 변경

CSV 내보내기:
  - 15개 컬럼: 품목코드~상태
  - UTF-8 BOM(\uFEFF) 포함
  - 파일명: 발주권고_YYYY-MM-DD.csv
```

**현재 한계점**

- 계절성/프로모션 수요 반영 불가
- 발주 실행(실제 PO 생성) 미구현 — 권고만 제공
- 실시간 재고 추적 없음 (스냅샷 기반)
- MOQ 반올림으로 과잉 발주 가능
- 다중 공급자 가격 비교 미지원
- 식단표/레시피가 Google Sheets 의존 — 오프라인 시 사용 불가

---

## 공통 유틸리티

### 포맷팅 (`src/utils/format.ts`)

| 함수 | 입력 | 출력 예시 | 용도 |
|------|------|----------|------|
| `formatCurrency(value)` | 150000000 | "1.5억" | 금액 표시 |
| `formatCurrency(value)` | 38000000 | "3800만" | 금액 표시 |
| `formatAxisKRW(value)` | 50000000 | "5000만" | 차트 축 |
| `formatPercent(value, decimals)` | 23.456 | "23.5%" | 비율 |
| `formatQty(value, unit)` | 1234 | "1,234개" | 수량 |

---

## 공통 UI 컴포넌트

| 컴포넌트 | 위치 | 용도 |
|----------|------|------|
| `SubTabLayout` | `src/components/SubTabLayout.tsx` | 서브탭 컨테이너 (재사용) |
| `Header` | `src/components/Header.tsx` | 상단바 (다크모드, 날짜필터, 알림, 내보내기) |
| `Sidebar` | `src/components/Sidebar.tsx` | 좌측 네비게이션 (6개 메인뷰 + 데이터 가용성 표시) |
| `Modal` | `src/components/Modal.tsx` | 상세 모달 (duck-typing으로 콘텐츠 분기) |
| `NotificationPanel` | - | 알림 드롭다운 (8개 하드코딩 알림) |
| `AIInsightSidebar` | - | AI 인사이트 우측 사이드바 |

---

## 전체 아키텍처 한계점 요약

### 보안

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| API 키 소스코드 하드코딩 | **높음** | ecountService.ts DEFAULT_CONFIG에 키 노출 |
| Supabase RLS 미적용 | **높음** | 서비스 역할 키로 전체 DB 접근 가능 |
| 데이터 접근 감사 로그 없음 | 중간 | 누가 무엇을 조회했는지 추적 불가 |
| 입력 검증 없음 | 중간 | Zod 스키마 정의됐으나 라우트에서 미적용 |

### 성능

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| 페이지네이션 미지원 | **높음** | 전체 데이터 일괄 반환 — 대규모 데이터 시 타임아웃 |
| 캐싱 레이어 없음 | 중간 | 매 요청마다 전체 재계산 |
| 가상 스크롤 없음 | 중간 | 대규모 테이블에서 성능 저하 |
| Rate Limiting 없음 | 중간 | DoS 취약점 |

### 안정성

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| Error Boundary 없음 | **높음** | 하위 컴포넌트 크래시 시 전체 앱 다운 |
| 에이전트 상태 인메모리 | **높음** | 서버 재시작 시 모든 학습/토론 이력 유실 |
| 트랜잭션 미지원 | 중간 | 부분 동기화 실패 시 DB 불일치 |
| SSE 재연결 없음 | 중간 | 네트워크 끊김 시 실시간 스트림 복구 불가 |

### 데이터 품질

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| 마진 30% 하드코딩 | **높음** | 실제 원가 기반이 아닌 추정값 |
| 노무비 25% 추정 | 중간 | 급여 시스템 연동 없이 추정 |
| 모달 콘텐츠 mock 데이터 | 중간 | MOCK_COST_BREAKDOWN 등 하드코딩 |
| 사용자 정보 하드코딩 | 낮음 | "박종철, 생산관리자" 고정 |

---

## 통계 요약

| 항목 | 수치 |
|------|------|
| **메인 뷰** | 6개 (홈, 수익, 원가, 생산, 재고, 설정) |
| **서브탭** | 16개 |
| **차트** | 30개+ (Area, Bar, Line, Pie, 이중축) |
| **테이블** | 14개+ |
| **API 엔드포인트** | 50개+ (11개 라우트 그룹) |
| **Supabase 테이블** | 7개 |
| **AI 에이전트** | 20개 (레거시 5 + Trio 12 + 거버넌스 2 + 오케스트레이터 1) |
| **프론트엔드 서비스** | 10개 |
| **백엔드 어댑터** | 5개 (Supabase, ECOUNT, GoogleSheet×2, Gemini) |
| **전역 상태 변수** | 40개+ (App.tsx) |
| **인사이트 compute 함수** | 10개 + recommendations |
| **메시지 타입** | 13개 (EventBus) |
