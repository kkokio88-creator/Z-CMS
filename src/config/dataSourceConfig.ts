/**
 * 구글시트 데이터 소스 설정
 * 각 시트별 스프레드시트 ID, 시트명, 헤더행, 데이터시작행, 컬럼매핑 관리
 * SettingsView에서 편집 → localStorage 저장 → MD 자동 업데이트
 */

// ─── 타입 정의 ───

export interface ColumnMapping {
  key: string;        // 정규화 필드명
  column: string;     // 원본 컬럼 (A, B, C ...)
  label: string;      // 한국어 라벨
  type: 'string' | 'number' | 'date';
  description?: string;
}

export interface DataSourceSheet {
  id: string;                  // 고유 식별자
  name: string;                // 표시명 (예: "매출")
  spreadsheetId: string;       // 구글 스프레드시트 ID
  sheetName: string;           // 시트 탭 이름
  headerRow: number;           // 헤더 행 번호 (1-based)
  dataStartRow: number;        // 데이터 시작 행 (1-based)
  enabled: boolean;            // 활성/비활성
  columns: ColumnMapping[];    // 컬럼 매핑
  notes?: string;              // 특이사항
}

export interface DataSourceConfig {
  version: string;
  lastUpdated: string;
  serviceAccount: string;
  sheets: DataSourceSheet[];
}

// ─── 기본 설정 ───

const SPREADSHEET_IDS = {
  menu: '1395EnPHzgOKCZ-kgSYzjNr84_QHPqIkQI8L9IBQUgWE',
  main: '1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI',
  bom:  '1H8EI3AaYG8m7xASFI6Rj8N6Zb7TvCnnGkr2MJtYHZO8',
};

export const DEFAULT_DATA_SOURCE_CONFIG: DataSourceConfig = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString().slice(0, 10),
  serviceAccount: 'z-cms-3077@gen-lang-client-0670850409.iam.gserviceaccount.com',
  sheets: [
    {
      id: 'menu_history',
      name: '식단표',
      spreadsheetId: SPREADSHEET_IDS.menu,
      sheetName: '식단_히스토리',
      headerRow: 3,
      dataStartRow: 4,
      enabled: true,
      columns: [
        { key: 'date', column: 'D', label: '날짜', type: 'date' },
        { key: 'dayOfWeek', column: 'E', label: '요일', type: 'string' },
        { key: 'weekNumber', column: 'G', label: '주차', type: 'number' },
        { key: 'menuName', column: 'K', label: '메뉴명(실속)', type: 'string' },
        { key: 'process', column: 'L', label: '공정', type: 'string' },
        { key: 'productCode', column: 'M', label: '품목코드', type: 'string' },
        { key: 'price', column: 'N', label: '가격', type: 'number' },
        { key: 'cost', column: 'O', label: '원가', type: 'number' },
      ],
      notes: '멀티헤더(3행), 식단타입 4종(실속/건강한시니어/시니어/청소연구소) 컬럼그룹 반복',
    },
    {
      id: 'daily_revenue',
      name: '매출',
      spreadsheetId: SPREADSHEET_IDS.main,
      sheetName: '매출',
      headerRow: 1,
      dataStartRow: 5,
      enabled: true,
      columns: [
        { key: 'date', column: 'A', label: '생산일', type: 'date' },
        { key: 'jasaRevenue', column: 'B', label: '자사(권장판매가)', type: 'number' },
        { key: 'coupangRevenue', column: 'C', label: '쿠팡(공급가)', type: 'number' },
        { key: 'kurlyRevenue', column: 'D', label: '컬리(공급가)', type: 'number' },
        { key: 'totalRevenue', column: 'E', label: '매출 총액', type: 'number' },
        { key: 'frozenSoup', column: 'F', label: '냉동국', type: 'number' },
        { key: 'bibimbap', column: 'H', label: '비빔밥', type: 'number' },
        { key: 'jasaSettlement', column: 'I', label: '자사 정산', type: 'number' },
        { key: 'coupangSettlement', column: 'J', label: '쿠팡 정산', type: 'number' },
        { key: 'kurlySettlement', column: 'K', label: '컬리 정산', type: 'number' },
        { key: 'productionQty', column: 'N', label: '생산수량', type: 'number' },
        { key: 'productionRevenue', column: 'O', label: '생산매출', type: 'number' },
      ],
      notes: '2~4행 빈/수식행, 숫자에 쉼표+공백, 월별소계행 존재',
    },
    {
      id: 'sales_detail',
      name: '판매실적',
      spreadsheetId: SPREADSHEET_IDS.main,
      sheetName: '판매',
      headerRow: 1,
      dataStartRow: 2,
      enabled: true,
      columns: [
        { key: 'date', column: 'A', label: '일별', type: 'date' },
        { key: 'customer', column: 'B', label: '거래처', type: 'string' },
        { key: 'productName', column: 'C', label: '품목별', type: 'string' },
        { key: 'productCode', column: 'D', label: '품목코드', type: 'string' },
        { key: 'quantity', column: 'E', label: '수량', type: 'number' },
        { key: 'supplyAmount', column: 'F', label: '공급가액(정산)', type: 'number', description: '플랫폼 수수료 정산 후 매출' },
        { key: 'vat', column: 'G', label: '부가세', type: 'number' },
        { key: 'total', column: 'H', label: '합계', type: 'number' },
        { key: 'recommendedRevenue', column: 'I', label: '권장판매매출', type: 'number', description: '실제 판매 가격(수수료 전)' },
      ],
      notes: '배송행은 마이너스 금액, 날짜형식 YYYY/MM/DD, 규격 컬럼 제거됨, 권장판매매출=수수료 전 실판매가',
    },
    {
      id: 'bom_san',
      name: 'BOM (SAN)',
      spreadsheetId: SPREADSHEET_IDS.bom,
      sheetName: '3. SAN_BOM',
      headerRow: 2,
      dataStartRow: 3,
      enabled: true,
      columns: [
        { key: 'productCode', column: 'A', label: '생산품목코드', type: 'string' },
        { key: 'productName', column: 'B', label: '생산품목명', type: 'string' },
        { key: 'bomVersion', column: 'C', label: 'BOM버전', type: 'string' },
        { key: 'productionQty', column: 'E', label: '생산수량', type: 'number' },
        { key: 'materialCode', column: 'F', label: '소모품목코드', type: 'string' },
        { key: 'materialName', column: 'G', label: '소모품목명', type: 'string' },
        { key: 'materialQty', column: 'I', label: '소모수량', type: 'number' },
        { key: 'packagingYield', column: 'N', label: '포장수율', type: 'number' },
        { key: 'coolingYield', column: 'O', label: '냉각수율', type: 'number' },
        { key: 'rawMaterialYield', column: 'P', label: '원재료수율', type: 'number' },
        { key: 'date', column: 'Q', label: '날짜', type: 'date' },
      ],
      notes: '1행 설명텍스트, 생산품:소모재료 = 1:N 관계',
    },
    {
      id: 'bom_zip',
      name: 'BOM (ZIP)',
      spreadsheetId: SPREADSHEET_IDS.bom,
      sheetName: '4. ZIP_BOM',
      headerRow: 2,
      dataStartRow: 3,
      enabled: true,
      columns: [
        { key: 'productCode', column: 'A', label: '생산품목코드', type: 'string' },
        { key: 'productName', column: 'B', label: '생산품목명', type: 'string' },
        { key: 'bomVersion', column: 'C', label: 'BOM버전', type: 'string' },
        { key: 'productionQty', column: 'E', label: '생산수량', type: 'number' },
        { key: 'materialCode', column: 'F', label: '소모품목코드', type: 'string' },
        { key: 'materialName', column: 'G', label: '소모품목명', type: 'string' },
        { key: 'materialQty', column: 'I', label: '소모수량', type: 'number' },
        { key: 'packagingYield', column: 'N', label: '포장수율', type: 'number' },
        { key: 'coolingYield', column: 'O', label: '냉각수율', type: 'number' },
        { key: 'date', column: 'Q', label: '날짜', type: 'date' },
      ],
      notes: '완제품(RES)→반제품(SAN)→원재료(ZIP) 3단 BOM',
    },
    {
      id: 'purchases',
      name: '구매현황',
      spreadsheetId: SPREADSHEET_IDS.main,
      sheetName: '구매',
      headerRow: 1,
      dataStartRow: 2,
      enabled: true,
      columns: [
        { key: 'date', column: 'A', label: '월/일', type: 'date', description: '형식: YYYY/MM/DD-N (순번 포함, 날짜만 추출)' },
        { key: 'productName', column: 'B', label: '품명 및 규격', type: 'string' },
        { key: 'productCode', column: 'C', label: '품목코드', type: 'string' },
        { key: 'quantity', column: 'D', label: '수량', type: 'number' },
        { key: 'unitPrice', column: 'E', label: '단가', type: 'number' },
        { key: 'supplyAmount', column: 'F', label: '공급가액', type: 'number' },
        { key: 'vat', column: 'G', label: '부가세', type: 'number' },
        { key: 'total', column: 'H', label: '합계', type: 'number' },
        { key: 'supplierName', column: 'I', label: '구매처명', type: 'string' },
      ],
      notes: '날짜에 순번 포함(YYYY/MM/DD-N), 숫자에 쉼표 포함, 접두사 ZIP_M_(원재료)/ZIP_H_(반재료)/ZIP_S_(부자재)',
    },
    {
      id: 'orders',
      name: '발주현황',
      spreadsheetId: SPREADSHEET_IDS.main,
      sheetName: '발주',
      headerRow: 1,
      dataStartRow: 2,
      enabled: true,
      columns: [
        { key: 'date', column: 'A', label: '일별', type: 'date' },
        { key: 'itemWithSpec', column: 'B', label: '품목명[규격]', type: 'string' },
        { key: 'quantity', column: 'C', label: '수량', type: 'number' },
        { key: 'supplyAmount', column: 'D', label: '공급가액', type: 'number' },
        { key: 'vat', column: 'E', label: '부가세', type: 'number' },
        { key: 'total', column: 'F', label: '합계', type: 'number' },
      ],
      notes: '품목명과 규격이 [규격] 형태로 통합, 분리 필요',
    },
    {
      id: 'utilities',
      name: '경비',
      spreadsheetId: SPREADSHEET_IDS.main,
      sheetName: '경비',
      headerRow: 3,
      dataStartRow: 9,
      enabled: true,
      columns: [
        { key: 'date', column: 'A', label: '검침일', type: 'date' },
        { key: 'elecPrev', column: 'B', label: '전기 전일검침', type: 'number' },
        { key: 'elecCurrTotal', column: 'F', label: '전기 당일합계', type: 'number' },
        { key: 'elecUsage', column: 'G', label: '전기 사용량(kWh)', type: 'number' },
        { key: 'elecCost', column: 'H', label: '전기 금액', type: 'number' },
        { key: 'waterPrev', column: 'I', label: '수도 전일검침', type: 'number' },
        { key: 'waterCurr', column: 'J', label: '수도 당일검침', type: 'number' },
        { key: 'waterUsage', column: 'K', label: '수도 사용량(ton)', type: 'number' },
        { key: 'waterCost', column: 'L', label: '수도 금액', type: 'number' },
        { key: 'gasPrev', column: 'M', label: '가스 전일검침', type: 'number' },
        { key: 'gasCurr', column: 'N', label: '가스 당일검침', type: 'number' },
        { key: 'gasUsage', column: 'O', label: '가스 사용량(m3)', type: 'number' },
        { key: 'gasCost', column: 'P', label: '가스 금액', type: 'number' },
      ],
      notes: '단가: 전기110원/kWh, 수도2290원/ton, 가스1000원/m3, 멀티헤더4행, 5~8빈행',
    },
    {
      id: 'waste_production',
      name: '폐기',
      spreadsheetId: SPREADSHEET_IDS.main,
      sheetName: '폐기',
      headerRow: 3,
      dataStartRow: 5,
      enabled: true,
      columns: [
        { key: 'date', column: 'A', label: '생산일', type: 'date' },
        { key: 'prodQtyNormal', column: 'B', label: '일반반찬(EA)', type: 'number' },
        { key: 'prodQtyPreprocess', column: 'C', label: '전처리(EA)', type: 'number' },
        { key: 'prodQtyFrozen', column: 'D', label: '냉동국(EA)', type: 'number' },
        { key: 'prodQtySauce', column: 'E', label: '소스(EA)', type: 'number' },
        { key: 'prodQtyBibimbap', column: 'F', label: '비빔밥(EA)', type: 'number' },
        { key: 'prodQtyTotal', column: 'G', label: '합계(EA)', type: 'number' },
        { key: 'prodKgNormal', column: 'H', label: '일반반찬(KG)', type: 'number' },
        { key: 'prodKgPreprocess', column: 'I', label: '전처리(KG)', type: 'number' },
        { key: 'prodKgFrozen', column: 'J', label: '냉동국(KG)', type: 'number' },
        { key: 'prodKgSauce', column: 'K', label: '소스(KG)', type: 'number' },
        { key: 'prodKgTotal', column: 'L', label: '합계(KG)', type: 'number' },
        { key: 'wasteFinishedEa', column: 'M', label: '완제품폐기(EA)', type: 'number' },
        { key: 'wasteFinishedPct', column: 'N', label: '완제품비율(%)', type: 'number' },
        { key: 'wasteSemiKg', column: 'O', label: '반제품폐기(KG)', type: 'number' },
        { key: 'wasteSemiPct', column: 'P', label: '반제품비율(%)', type: 'number' },
      ],
      notes: '멀티헤더3행, 4행빈행, #DIV/0! 가능→0처리, 카테고리5종',
    },
    {
      id: 'labor_cost',
      name: '노무비',
      spreadsheetId: SPREADSHEET_IDS.main,
      sheetName: '노무비',
      headerRow: 3,
      dataStartRow: 4,
      enabled: true,
      columns: [
        { key: 'weekNumber', column: 'A', label: '주차', type: 'number' },
        { key: 'date', column: 'B', label: '날짜', type: 'date', description: '형식: 2026. 1. 1.' },
        { key: 'department', column: 'C', label: '구분', type: 'string' },
        { key: 'workerCount', column: 'D', label: '근무인원', type: 'number' },
        { key: 'weekdayRegular', column: 'E', label: '평일소정', type: 'number' },
        { key: 'weekdayOvertime', column: 'F', label: '평일연장', type: 'number' },
        { key: 'weekdayNight', column: 'G', label: '평일야간', type: 'number' },
        { key: 'weekdayTotal', column: 'H', label: '평일합계', type: 'number' },
        { key: 'holidayRegular', column: 'I', label: '휴일소정', type: 'number' },
        { key: 'holidayOvertime', column: 'J', label: '휴일연장', type: 'number' },
        { key: 'holidayNight', column: 'K', label: '휴일야간', type: 'number' },
        { key: 'holidayTotal', column: 'L', label: '휴일합계', type: 'number' },
        { key: 'costWeekdayRegular', column: 'M', label: '평일소정비용', type: 'number' },
        { key: 'costWeekdayOvertime', column: 'N', label: '평일연장비용', type: 'number' },
        { key: 'costWeekdayNight', column: 'O', label: '평일야간비용', type: 'number' },
        { key: 'costHolidayRegular', column: 'P', label: '휴일소정비용', type: 'number' },
        { key: 'costHolidayOvertime', column: 'Q', label: '휴일연장비용', type: 'number' },
        { key: 'costHolidayNight', column: 'R', label: '휴일야간비용', type: 'number' },
        { key: 'totalLaborCost', column: 'S', label: '노무비합계', type: 'number' },
        { key: 'monthlyEstimate', column: 'T', label: '월노무비현황', type: 'number' },
      ],
      notes: '날짜형식 "2026. 1. 1." → YYYY-MM-DD 변환, 부서별 여러행/일',
    },
  ],
};

// ─── localStorage 연동 ───

const STORAGE_KEY = 'Z_CMS_DATA_SOURCE_CONFIG';

export function loadDataSourceConfig(): DataSourceConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as DataSourceConfig;
      // 버전이 같으면 저장값 사용
      if (parsed.version === DEFAULT_DATA_SOURCE_CONFIG.version) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('데이터소스 설정 로드 실패:', e);
  }
  return DEFAULT_DATA_SOURCE_CONFIG;
}

export function saveDataSourceConfig(config: DataSourceConfig): void {
  config.lastUpdated = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetDataSourceConfig(): DataSourceConfig {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_DATA_SOURCE_CONFIG;
}

/** 스프레드시트 ID에서 URL 생성 */
export function getSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

/** 스프레드시트 URL에서 ID 추출 */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
