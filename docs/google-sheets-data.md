# Z-CMS 구글시트 데이터 소스 정규화 문서

> 이 문서는 Z-CMS 설정 탭에서 자동 생성/관리됩니다.
> 마지막 업데이트: 2026-02-10

---

## 1. 데이터 소스 총괄

| # | 데이터 | 스프레드시트 ID | 시트명 | 헤더행 | 데이터시작행 | 상태 |
|---|--------|----------------|--------|--------|-------------|------|
| 1 | 식단표 | `1395EnPHzgOKCZ-kgSYzjNr84_QHPqIkQI8L9IBQUgWE` | 식단_히스토리 | 3 | 4 | 활성 |
| 2 | 매출 | `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI` | 매출 | 1 | 5 | 활성 |
| 3 | 판매실적 | `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI` | 판매 | 1 | 2 | 활성 |
| 4 | BOM (SAN) | `1H8EI3AaYG8m7xASFI6Rj8N6Zb7TvCnnGkr2MJtYHZO8` | 3. SAN_BOM | 2 | 3 | 활성 |
| 5 | BOM (ZIP) | `1H8EI3AaYG8m7xASFI6Rj8N6Zb7TvCnnGkr2MJtYHZO8` | 4. ZIP_BOM | 2 | 3 | 활성 |
| 6 | 구매현황 | `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI` | 구매 | 1 | 2 | 활성 |
| 7 | 발주현황 | `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI` | 발주 | 1 | 2 | 활성 |
| 8 | 경비 | `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI` | 경비 | 3 | 9 | 활성 |
| 9 | 폐기 | `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI` | 폐기 | 3 | 5 | 활성 |
| 10 | 노무비 | `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI` | 노무비 | 3 | 4 | 활성 |

---

## 2. 정규화 스키마 상세

### 2.1 식단표 (`menu_history`)

**원본 시트**: 식단_히스토리 (스프레드시트: `1395EnPHzgOKCZ-kgSYzjNr84_QHPqIkQI8L9IBQUgWE`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `date` | D열 (날짜) | `string` (YYYY-MM-DD) | 식단 날짜 |
| `dayOfWeek` | E열 (요일) | `string` | 화수목, 금토 등 |
| `weekNumber` | G열 (주차) | `number` | 연간 주차 |
| `mealType` | 컬럼 그룹 | `string` | 실속/건강한시니어/시니어/청소연구소 |
| `menuName` | K/W/AI/AV열 | `string` | 메뉴명 |
| `process` | L/X/AJ/AW열 | `string` | 공정 |
| `productCode` | M/Y/AK/AX열 | `string` | 품목코드 |
| `price` | N/Z/AL/AY열 | `number` | 판매가격 (원) |
| `cost` | O/AA/AM/AZ열 | `number` | 원가 (원) |

**특이사항**:
- 멀티헤더 구조 (3행), 데이터는 4행부터
- 식단 타입별로 같은 컬럼 패턴이 반복 (메뉴명→공정→품목코드→가격→원가→미사용→당월동/타→전월동/타→전전월동/타)
- 하나의 날짜에 여러 메뉴 행 존재 (반찬 단위)

---

### 2.2 매출 (`daily_revenue`)

**원본 시트**: 매출 (스프레드시트: `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `date` | A열 (생산일) | `string` (YYYY-MM-DD) | 생산일 기준 |
| `jasaRevenue` | B열 (자사 권장판매가) | `number` | 자사몰 매출 |
| `coupangRevenue` | C열 (쿠팡 공급가) | `number` | 쿠팡 매출 |
| `kurlyRevenue` | D열 (컬리 공급가) | `number` | 컬리 매출 |
| `totalRevenue` | E열 (매출 총액) | `number` | 매출 합계 (=B+C+D) |
| `frozenSoup` | F열 (냉동국) | `number` | 냉동국 매출 |
| `etc` | G열 (기타) | `number` | 기타 매출 |
| `bibimbap` | H열 (비빔밥) | `number` | 비빔밥 수량 |
| `jasaSettlement` | I열 (자사) | `number` | 자사 정산금액 (=매출/2) |
| `coupangSettlement` | J열 (쿠팡) | `number` | 쿠팡 정산금액 (=매출/2) |
| `kurlySettlement` | K열 (컬리) | `number` | 컬리 정산금액 (=매출/2) |
| `productionQty` | N열 (생산수량) | `number` | 일 생산수량 (EA) |
| `productionRevenue` | O열 (매출 총액 생산매출) | `number` | 생산 기준 매출 |

**특이사항**:
- 헤더 1행, 2~4행은 빈 행/수식 행, 데이터 5행부터
- 숫자에 쉼표+공백 포함 → 파싱 시 제거 필요
- 월별 소계 행 존재 (예: "11월 생산매출")

---

### 2.3 판매실적 (`sales_detail`)

**원본 시트**: 판매 (스프레드시트: `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `productCode` | A열 (품목코드) | `string` | 품목코드 (BAN_P_xxxx 등) |
| `productName` | B열 (품목명) | `string` | 품목명 |
| `date` | C열 (일별) | `string` (YYYY/MM/DD) | 판매일 |
| `customer` | D열 (거래처별) | `string` | 거래처명 (쿠팡/컬리 등) |
| `itemName` | E열 (품목별) | `string` | 상품명 (로켓프레시 등) |
| `spec` | F열 (규격) | `string` | 규격 (2KG, EA 등) |
| `quantity` | G열 (수량) | `number` | 판매 수량 |
| `supplyAmount` | H열 (공급가액) | `number` | 공급가액 (원) |
| `vat` | I열 (부가세) | `number` | 부가세 (원) |
| `total` | J열 (합계) | `number` | 합계 (원) |

**특이사항**:
- 헤더 1행, 데이터 2행부터
- "배송" 행은 수수료로 마이너스 금액
- 날짜 형식: `YYYY/MM/DD`

---

### 2.4 BOM — SAN (`bom_san`)

**원본 시트**: 3. SAN_BOM (스프레드시트: `1H8EI3AaYG8m7xASFI6Rj8N6Zb7TvCnnGkr2MJtYHZO8`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `productCode` | A열 (생산품목코드) | `string` | 생산품 코드 (SAN_xxxx) |
| `productName` | B열 (생산품목명) | `string` | 생산품명 |
| `bomVersion` | C열 (BOM버전) | `string` | BOM 버전 |
| `isExisting` | D열 (기존BOM여부) | `string` | Y/N |
| `productionQty` | E열 (생산수량) | `number` | 생산 수량 (보통 1) |
| `materialCode` | F열 (소모품목코드) | `string` | 소모 원재료 코드 |
| `materialName` | G열 (소모품목명) | `string` | 소모 원재료명 |
| `materialBomVersion` | H열 (소모BOM버전) | `string` | 소모품 BOM 버전 |
| `materialQty` | I열 (소모수량) | `number` | 소모 수량 (kg 기준) |
| `location` | J열 (위치) | `string` | 위치 |
| `note` | K열 (적요) | `string` | 적요 |
| `additionalQty` | L열 (소모추가수량) | `number` | 추가 소모량 |
| `packagingYield` | N열 (포장수율) | `number` | 포장수율 (%) |
| `coolingYield` | O열 (냉각수율) | `number` | 냉각수율 (%) |
| `rawMaterialYield` | P열 (원재료수율) | `number` | 원재료수율 (%) |
| `date` | Q열 (날짜) | `string` (YYYY/MM/DD) | 등록일 |

**특이사항**:
- 1행은 설명 텍스트, 실제 헤더는 2행
- 하나의 생산품에 여러 소모재료 행 (1:N 관계)
- S~Z열: MES 업로드용 데이터 (별도)

---

### 2.5 BOM — ZIP (`bom_zip`)

**원본 시트**: 4. ZIP_BOM (스프레드시트: `1H8EI3AaYG8m7xASFI6Rj8N6Zb7TvCnnGkr2MJtYHZO8`)

- 스키마는 `bom_san`과 동일
- 생산품 코드: RES_P_xxxx (완제품) → SAN_xxxx / ZIP_S_xxxx (반제품/부자재)
- 완제품(RES) → 반제품(SAN) → 원재료(ZIP) 3단계 BOM 구조

---

### 2.6 구매현황 (`purchases`)

**원본 시트**: 구매 (스프레드시트: `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `date` | A열 (일별) | `string` (YYYY/MM/DD) | 구매일 |
| `productName` | B열 (품목별) | `string` | 품목명 (원재료명_산지) |
| `productCode` | C열 (품목코드) | `string` | 품목코드 (ZIP_M_xxxx) |
| `quantity` | D열 (수량) | `number` | 구매 수량 |
| `unitPrice` | E열 (단가) | `number` | 단가 (원) |
| `supplyAmount` | F열 (공급가액) | `number` | 공급가액 (원) |
| `vat` | G열 (부가세) | `number` | 부가세 (원) |
| `total` | H열 (합계) | `number` | 합계 (원) |
| `receivingPrice` | I열 (입고단가) | `number` | 입고단가 (원) |
| `receivingTotal` | J열 (입고단가*수량) | `number` | 입고 금액 (원) |
| `customNumber` | K열 (사용자지정숫자2) | `number` | 사용자 정의 단가 |

**특이사항**:
- 숫자에 쉼표 포함 → 파싱 시 제거 필요
- 품목코드 접두사: ZIP_M_ (원재료), ZIP_H_ (반재료), ZIP_S_ (부자재)

---

### 2.7 발주현황 (`orders`)

**원본 시트**: 발주 (스프레드시트: `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `date` | A열 (일별) | `string` (YYYY/MM/DD) | 발주일 |
| `itemWithSpec` | B열 (품목명[규격]) | `string` | 품목명 [규격] 통합 |
| `quantity` | C열 (수량) | `number` | 발주 수량 |
| `supplyAmount` | D열 (공급가액) | `number` | 공급가액 (원) |
| `vat` | E열 (부가세) | `number` | 부가세 (원) |
| `total` | F열 (합계) | `number` | 합계 (원) |

**특이사항**:
- 품목명과 규격이 하나의 셀에 통합 (예: "점보롤화장지 [16EA]")
- 파싱 시 `[` 기준으로 품목명과 규격 분리 가능

---

### 2.8 경비 (`utilities`)

**원본 시트**: 경비 (스프레드시트: `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `date` | A열 | `string` (YYYY-MM-DD) | 검침일 |
| `elecPrev` | B열 (전일검침 kW/h) | `number` | 전기 전일 검침값 |
| `elecCurr4` | C열 (당일검침 4호) | `number` | 전기 당일 4호기 |
| `elecCurr5` | D열 (당일검침 5호) | `number` | 전기 당일 5호기 |
| `elecCurr6` | E열 (당일검침 6호) | `number` | 전기 당일 6호기 |
| `elecCurrTotal` | F열 (합계) | `number` | 전기 당일 합계 |
| `elecUsage` | G열 (일일 사용량 kW/h) | `number` | 전기 일일 사용량 |
| `elecCost` | H열 (사용금액 원) | `number` | 전기 사용금액 (원) |
| `waterPrev` | I열 (전일검침 ton) | `number` | 수도 전일 검침값 |
| `waterCurr` | J열 (당일검침 ton) | `number` | 수도 당일 검침값 |
| `waterUsage` | K열 (일일 사용량 ton) | `number` | 수도 일일 사용량 |
| `waterCost` | L열 (사용금액) | `number` | 수도 사용금액 (원) |
| `gasPrev` | M열 (전일검침 m3) | `number` | 가스 전일 검침값 |
| `gasCurr` | N열 (당일검침 m3) | `number` | 가스 당일 검침값 |
| `gasUsage` | O열 (일일 사용량 m3) | `number` | 가스 일일 사용량 |
| `gasCost` | P열 (사용금액) | `number` | 가스 사용금액 (원) |

**특이사항**:
- 단가 행(2행): 전기 110원/kWh, 수도 2,290원/ton, 가스 1,000원/m3
- 멀티헤더 (1~4행), 5~8행 빈 행, 데이터 9행부터
- 날짜가 내림차순 (최신 날짜가 위)

---

### 2.9 폐기 (`waste_production`)

**원본 시트**: 폐기 (스프레드시트: `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `date` | A열 (생산일) | `string` (YYYY-MM-DD) | 생산일 |
| `prodQtyNormal` | B열 (일반반찬 EA) | `number` | 일반반찬 생산수량 |
| `prodQtyPreprocess` | C열 (전전처리 EA) | `number` | 전처리 생산수량 |
| `prodQtyFrozen` | D열 (냉동국 EA) | `number` | 냉동국 생산수량 |
| `prodQtySauce` | E열 (소스 EA) | `number` | 소스 생산수량 |
| `prodQtyBibimbap` | F열 (비빔밥 EA) | `number` | 비빔밥 생산수량 |
| `prodQtyTotal` | G열 (합계 EA) | `number` | 생산수량 합계 |
| `prodKgNormal` | H열 (일반반찬 KG) | `number` | 일반반찬 생산량(KG) |
| `prodKgPreprocess` | I열 (전전처리 KG) | `number` | 전처리 생산량(KG) |
| `prodKgFrozen` | J열 (냉동국 KG) | `number` | 냉동국 생산량(KG) |
| `prodKgSauce` | K열 (소스 KG) | `number` | 소스 생산량(KG) |
| `prodKgTotal` | L열 (합계 KG) | `number` | 생산량 합계(KG) |
| `wasteFinishedEa` | M열 (완제품 폐기량 EA) | `number` | 완제품 폐기(EA) |
| `wasteFinishedPct` | N열 (완제품 비율 %) | `number` | 완제품 폐기율(%) |
| `wasteSemiKg` | O열 (반제품 폐기량 KG) | `number` | 반제품 폐기(KG) |
| `wasteSemiPct` | P열 (반제품 비율 %) | `number` | 반제품 폐기율(%) |

**특이사항**:
- 멀티헤더 (3행), 4행 빈행, 데이터 5행부터
- 카테고리: 일반반찬, 전전처리(=전처리), 냉동국, 소스, 비빔밥
- 비율 필드는 `#DIV/0!` 가능 (빈 행) → 0으로 처리

---

### 2.10 노무비 (`labor_cost`)

**원본 시트**: 노무비 (스프레드시트: `1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI`)

| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |
|-------------|-----------|------|------|
| `weekNumber` | A열 (주차) | `number` | 월간 주차 |
| `date` | B열 (날짜) | `string` (YYYY.M.D) | 근무일 |
| `department` | C열 (구분) | `string` | 부서 (구내식당/생산관리실 등) |
| `workerCount` | D열 (근무인원) | `number` | 근무인원 (명) |
| `weekdayRegular` | E열 (평일소정) | `number` | 평일 소정근로시간 |
| `weekdayOvertime` | F열 (평일연장) | `number` | 평일 연장근로시간 |
| `weekdayNight` | G열 (평일야간) | `number` | 평일 야간근로시간 |
| `weekdayTotal` | H열 (평일합계) | `number` | 평일 근로시간 합계 |
| `holidayRegular` | I열 (휴일소정) | `number` | 휴일 소정근로시간 |
| `holidayOvertime` | J열 (휴일연장) | `number` | 휴일 연장근로시간 |
| `holidayNight` | K열 (휴일야간) | `number` | 휴일 야간근로시간 |
| `holidayTotal` | L열 (휴일합계) | `number` | 휴일 근로시간 합계 |
| `costWeekdayRegular` | M열 (평일소정비용) | `number` | 평일 소정비용 (원) |
| `costWeekdayOvertime` | N열 (평일연장비용) | `number` | 평일 연장비용 (원) |
| `costWeekdayNight` | O열 (평일야간비용) | `number` | 평일 야간비용 (원) |
| `costHolidayRegular` | P열 (휴일소정비용) | `number` | 휴일 소정비용 (원) |
| `costHolidayOvertime` | Q열 (휴일연장비용) | `number` | 휴일 연장비용 (원) |
| `costHolidayNight` | R열 (휴일야간비용) | `number` | 휴일 야간비용 (원) |
| `totalLaborCost` | S열 (노무비합계) | `number` | 일일 노무비 합계 (원) |
| `monthlyEstimate` | T열 (월 노무비 현황) | `number` | 월 예상 노무비 (원) |

**특이사항**:
- 멀티헤더 (3행), 데이터 4행부터
- 하나의 날짜에 부서별 여러 행 존재 (구내식당, 생산관리실 등)
- 날짜 형식: `2026. 1. 1.` (공백 포함) → `YYYY-MM-DD`로 정규화 필요

---

## 3. 품목코드 체계

| 접두사 | 분류 | 설명 | 예시 |
|--------|------|------|------|
| `RES_P_` | 완제품 | 최종 판매 상품 (밀키트) | RES_P_0001 |
| `BAN_P_` | 반가공품 | 반가공 판매 상품 | BAN_P_0008 |
| `SAN_` | 반제품 | 반조리 중간제품 | SAN_1030 |
| `ZIP_H_` | 반재료 | 반가공 재료 | ZIP_H_1150 |
| `ZIP_M_` | 원재료 | 원재료 (식자재) | ZIP_M_1017 |
| `ZIP_S_` | 부자재 | 포장재/소모품 | ZIP_S_6174 |
| `ZIP_A_` | 기타 | 배송비 등 | ZIP_A_0001 |

---

## 4. BOM 3단 구조

```
완제품 (RES_P_xxxx)
  ├── 반제품 (SAN_xxxx) × 수량    ← ZIP_BOM에서 정의
  │     ├── 반재료 (ZIP_H_xxxx) × 소모량  ← SAN_BOM에서 정의
  │     ├── 원재료 (ZIP_M_xxxx) × 소모량
  │     └── 부자재 (ZIP_S_xxxx) × 소모량
  └── 부자재 (ZIP_S_xxxx) × 수량
```

---

## 5. 채널 구분

| 채널 | 거래처명 (판매 시트) | 매출 시트 컬럼 | 정산 방식 |
|------|---------------------|---------------|-----------|
| 자사몰 | 고도몰 | B열 (자사 권장판매가) | 익일 입금확인 |
| 쿠팡 | (주)포워드벤처스(쿠팡) | C열 (쿠팡 공급가) | 로켓프레시 정산 |
| 컬리 | (주)컬리 | D열 (컬리 공급가) | 컬리 정산 |

---

## 6. 데이터 정제 규칙

1. **숫자 파싱**: 쉼표(,), 공백, 원(원) 제거 후 `parseFloat`
2. **날짜 정규화**: 모든 날짜를 `YYYY-MM-DD` 형식으로 통일
   - `YYYY/MM/DD` → `YYYY-MM-DD`
   - `YYYY. M. D.` → `YYYY-MM-DD`
3. **빈 값 처리**: 빈 셀은 숫자=`0`, 문자열=`""`, 비율=`0`
4. **에러 값**: `#DIV/0!`, `#N/A`, `#VALUE!` → `0` 또는 `null`
5. **소계 행 제외**: "월 생산매출" 등 소계 텍스트가 포함된 행 건너뜀
6. **품목명 정규화**: 앞뒤 공백 제거, 연속 공백 단일화
