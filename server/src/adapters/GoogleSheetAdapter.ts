/**
 * Google Sheets Adapter
 * 구글 시트에서 데이터를 가져와 정규화된 형식으로 변환
 */

import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = '1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI';
const BOM_SPREADSHEET_ID = '1H8EI3AaYG8m7xASFI6Rj8N6Zb7TvCnnGkr2MJtYHZO8';

// 시트 GID 매핑
const SHEET_GIDS = {
  dailySales: 257604395, // 일별 채널 매출
  salesDetail: 581799740, // 판매 상세 (품목별)
  production: 752670530, // 생산/폐기 데이터
  purchases: 781584713, // 구매/원자재
  utilities: 823144216, // 유틸리티 (전기/수도/가스)
};

// 정규화된 데이터 타입들
export interface DailySalesData {
  date: string;
  jasaPrice: number;
  coupangPrice: number;
  kurlyPrice: number;
  totalRevenue: number;
  frozenSoup: number;
  etc: number;
  bibimbap: number;
  jasaHalf: number;
  coupangHalf: number;
  kurlyHalf: number;
  frozenHalf: number;
  etcHalf: number;
  productionQty: number;
  productionRevenue: number;
}

export interface SalesDetailData {
  productCode: string;
  productName: string;
  date: string;
  customer: string;
  productDesc: string;
  spec: string;
  quantity: number;
  supplyAmount: number;
  vat: number;
  total: number;
}

export interface ProductionData {
  date: string;
  prodQtyNormal: number;
  prodQtyPreprocess: number;
  prodQtyFrozen: number;
  prodQtySauce: number;
  prodQtyBibimbap: number;
  prodQtyTotal: number;
  prodKgNormal: number;
  prodKgPreprocess: number;
  prodKgFrozen: number;
  prodKgSauce: number;
  prodKgTotal: number;
  wasteFinishedEa: number;
  wasteFinishedPct: number;
  wasteSemiKg: number;
  wasteSemiPct: number;
}

export interface PurchaseData {
  date: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  vat: number;
  total: number;
  inboundPrice: number;
  inboundTotal: number;
}

export interface UtilityData {
  date: string;
  elecPrev: number;
  elecCurr: number;
  elecUsage: number;
  elecCost: number;
  waterPrev: number;
  waterCurr: number;
  waterUsage: number;
  waterCost: number;
  gasPrev: number;
  gasCurr: number;
  gasUsage: number;
  gasCost: number;
}

// 노무비 데이터 타입
export interface LaborData {
  week: string;
  date: string;
  department: string;
  headcount: number;
  weekdayRegularHours: number;
  weekdayOvertimeHours: number;
  weekdayNightHours: number;
  weekdayTotalHours: number;
  holidayRegularHours: number;
  holidayOvertimeHours: number;
  holidayNightHours: number;
  holidayTotalHours: number;
  weekdayRegularPay: number;
  weekdayOvertimePay: number;
  weekdayNightPay: number;
  holidayRegularPay: number;
  holidayOvertimePay: number;
  holidayNightPay: number;
  totalPay: number;
}

// BOM 데이터 타입 (3.SAN_BOM, 4.ZIP_BOM 시트)
export interface BomSheetData {
  source: 'SAN' | 'ZIP';
  productCode: string;
  productName: string;
  bomVersion: string;
  isExistingBom: boolean;
  productionQty: number;
  materialCode: string;
  materialName: string;
  materialBomVersion: string;
  consumptionQty: number;
  location: string;
  remark: string;
  additionalQty: number;
}

// 자재 마스터 데이터 타입 (1.자재정보 시트)
export interface MaterialMasterData {
  no: number;
  category: string;
  issueType: string;
  materialCode: string;
  materialName: string;
  preprocessYield: number;
  spec: string;
  unit: string;
  unitPrice: number;
  safetyStock: number;
  excessStock: number;
  leadTimeDays: number;
  recentOutputQty: number;
  dailyAvg: number;
  note: string;
  inUse: boolean;
}

export class GoogleSheetAdapter {
  private baseUrl: string;
  private sheetsClient: sheets_v4.Sheets | null = null;

  constructor() {
    this.baseUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
  }

  /**
   * Google Sheets API 인증 클라이언트 (비공개 스프레드시트 접근용)
   */
  private async getAuthClient(): Promise<sheets_v4.Sheets> {
    if (this.sheetsClient) return this.sheetsClient;

    // Method 1: GOOGLE_SERVICE_ACCOUNT_JSON env var
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const credentials = JSON.parse(serviceAccountJson);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      this.sheetsClient = google.sheets({ version: 'v4', auth: await auth.getClient() as any });
      return this.sheetsClient;
    }

    // Method 2: Service account key file
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    if (keyPath) {
      const resolved = path.resolve(keyPath);
      if (fs.existsSync(resolved)) {
        const credentials = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        this.sheetsClient = google.sheets({ version: 'v4', auth: await auth.getClient() as any });
        return this.sheetsClient;
      }
    }

    throw new Error('Google Sheets 인증 정보 없음 (GOOGLE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_SERVICE_ACCOUNT_KEY_PATH 필요)');
  }

  /**
   * Google Sheets API로 인증된 시트 데이터 가져오기 (비공개 스프레드시트용)
   */
  private async fetchSheetByApi(spreadsheetId: string, sheetName: string): Promise<string[][]> {
    try {
      const client = await this.getAuthClient();
      const response = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:Z`,
      });
      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];
      return rows.map(row => row.map(cell => String(cell ?? '')));
    } catch (error) {
      console.error(`Failed to fetch sheet "${sheetName}" via API:`, error);
      return [];
    }
  }

  /**
   * CSV 문자열을 파싱하여 2D 배열로 변환
   */
  private parseCSV(csv: string): string[][] {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const nextChar = csv[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentLine.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentLine.push(currentField.trim());
          if (currentLine.some(f => f !== '')) {
            lines.push(currentLine);
          }
          currentLine = [];
          currentField = '';
          if (char === '\r') i++; // Skip \n after \r
        } else {
          currentField += char;
        }
      }
    }

    // Push last field and line
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.some(f => f !== '')) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * 숫자 문자열을 파싱 (쉼표 제거, 빈값 처리)
   */
  private parseNumber(value: string): number {
    if (!value || value.trim() === '' || value.trim() === '-') return 0;
    const cleaned = value.replace(/,/g, '').replace(/\s/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * 날짜 문자열 정규화 (YYYY-MM-DD 또는 YYYY/MM/DD → YYYY-MM-DD)
   */
  private parseDate(value: string): string {
    if (!value || value.trim() === '') return '';
    return value.trim().replace(/\//g, '-');
  }

  /**
   * 시트 이름으로 데이터 가져오기
   * @param sheetName 시트 이름
   * @param spreadsheetId 다른 스프레드시트에서 가져올 때 ID 지정
   */
  private async fetchSheetByName(sheetName: string, spreadsheetId?: string): Promise<string[][]> {
    const baseUrl = spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`
      : this.baseUrl;
    const url = `${baseUrl}&sheet=${encodeURIComponent(sheetName)}`;

    try {
      const response = await fetch(url, { headers: { Accept: 'text/csv' } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const csv = await response.text();
      return this.parseCSV(csv);
    } catch (error) {
      console.error(`Failed to fetch sheet "${sheetName}":`, error);
      return [];
    }
  }

  /**
   * 시트 데이터 가져오기
   */
  private async fetchSheet(gid: number): Promise<string[][]> {
    const url = `${this.baseUrl}&gid=${gid}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/csv',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const csv = await response.text();
      return this.parseCSV(csv);
    } catch (error) {
      console.error(`Failed to fetch sheet gid=${gid}:`, error);
      return [];
    }
  }

  /**
   * 일별 채널 매출 데이터 가져오기
   */
  async fetchDailySales(): Promise<DailySalesData[]> {
    const rows = await this.fetchSheet(SHEET_GIDS.dailySales);
    const results: DailySalesData[] = [];

    // 첫 번째 행은 헤더, 데이터는 2행부터
    // 빈 행과 합계 행 제외
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const date = this.parseDate(row[0]);

      // 날짜가 없는 행(합계 행 등) 제외
      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

      results.push({
        date,
        jasaPrice: this.parseNumber(row[1]),
        coupangPrice: this.parseNumber(row[2]),
        kurlyPrice: this.parseNumber(row[3]),
        totalRevenue: this.parseNumber(row[4]),
        frozenSoup: this.parseNumber(row[5]),
        etc: this.parseNumber(row[6]),
        bibimbap: this.parseNumber(row[7]),
        jasaHalf: this.parseNumber(row[8]),
        coupangHalf: this.parseNumber(row[9]),
        kurlyHalf: this.parseNumber(row[10]),
        frozenHalf: this.parseNumber(row[11]),
        etcHalf: this.parseNumber(row[12]),
        productionQty: this.parseNumber(row[13]),
        productionRevenue: this.parseNumber(row[14]),
      });
    }

    return results.sort((a, b) => b.date.localeCompare(a.date)); // 최신순 정렬
  }

  /**
   * 판매 상세 데이터 가져오기
   */
  async fetchSalesDetail(): Promise<SalesDetailData[]> {
    const rows = await this.fetchSheet(SHEET_GIDS.salesDetail);
    const results: SalesDetailData[] = [];

    // 헤더: 품목코드, 품목명, 일별, 거래처별, 품목별, 규격, 수량, 공급가액, 부가세, 합계
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || row[0].trim() === '') continue;

      results.push({
        productCode: row[0] || '',
        productName: row[1] || '',
        date: this.parseDate(row[2]),
        customer: row[3] || '',
        productDesc: row[4] || '',
        spec: row[5] || '',
        quantity: this.parseNumber(row[6]),
        supplyAmount: this.parseNumber(row[7]),
        vat: this.parseNumber(row[8]),
        total: this.parseNumber(row[9]),
      });
    }

    return results;
  }

  /**
   * 생산/폐기 데이터 가져오기
   */
  async fetchProduction(): Promise<ProductionData[]> {
    const rows = await this.fetchSheet(SHEET_GIDS.production);
    const results: ProductionData[] = [];

    // 복잡한 헤더 구조 - 실제 데이터는 컬럼 인덱스로 매핑
    // 헤더 생산일, 생산수량(EA) 일반반찬, 전전처리, 냉동국, 소스, 비빔밥, 합계,
    // 생산량(KG) 일반반찬, 전전처리, 냉동국, 소스, 합계,
    // 완제품폐기량(EA), 비율(%), 반제품폐기량(KG), 반제품비율
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const date = this.parseDate(row[0]);

      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

      results.push({
        date,
        prodQtyNormal: this.parseNumber(row[1]),
        prodQtyPreprocess: this.parseNumber(row[2]),
        prodQtyFrozen: this.parseNumber(row[3]),
        prodQtySauce: this.parseNumber(row[4]),
        prodQtyBibimbap: this.parseNumber(row[5]),
        prodQtyTotal: this.parseNumber(row[6]),
        prodKgNormal: this.parseNumber(row[7]),
        prodKgPreprocess: this.parseNumber(row[8]),
        prodKgFrozen: this.parseNumber(row[9]),
        prodKgSauce: this.parseNumber(row[10]),
        prodKgTotal: this.parseNumber(row[11]),
        wasteFinishedEa: this.parseNumber(row[12]),
        wasteFinishedPct: this.parseNumber(row[13]),
        wasteSemiKg: this.parseNumber(row[14]),
        wasteSemiPct: this.parseNumber(row[15]),
      });
    }

    return results.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * 구매/원자재 데이터 가져오기
   */
  async fetchPurchases(): Promise<PurchaseData[]> {
    const rows = await this.fetchSheet(SHEET_GIDS.purchases);
    const results: PurchaseData[] = [];

    // 헤더: 일별, 품목별, 품목코드, 수량, 단가, 공급가액, 부가세, 합계, 입고단가, 입고단가*수량, 사용자지정숫자2
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const date = this.parseDate(row[0]);

      if (!date || (!date.match(/^\d{4}\/\d{2}\/\d{2}$/) && !date.match(/^\d{4}-\d{2}-\d{2}$/)))
        continue;

      results.push({
        date: date.replace(/\//g, '-'),
        productName: row[1] || '',
        productCode: row[2] || '',
        quantity: this.parseNumber(row[3]),
        unitPrice: this.parseNumber(row[4]),
        supplyAmount: this.parseNumber(row[5]),
        vat: this.parseNumber(row[6]),
        total: this.parseNumber(row[7]),
        inboundPrice: this.parseNumber(row[8]),
        inboundTotal: this.parseNumber(row[9]),
      });
    }

    return results;
  }

  /**
   * 유틸리티 데이터 가져오기
   */
  async fetchUtilities(): Promise<UtilityData[]> {
    const rows = await this.fetchSheet(SHEET_GIDS.utilities);
    const results: UtilityData[] = [];

    // 복잡한 헤더 - 컬럼 인덱스로 매핑
    // 날짜, 전기(전일검침, 당일검침, 공백, 공백, 공백, 일일사용량, 사용금액),
    // 수도(전일검침, 당일검침, 일일사용량, 사용금액),
    // 가스(전일검침, 당일검침, 일일사용량, 사용금액)
    for (let i = 2; i < rows.length; i++) {
      // 헤더가 2행에 걸쳐있을 수 있음
      const row = rows[i];
      const date = this.parseDate(row[0]);

      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

      results.push({
        date,
        elecPrev: this.parseNumber(row[1]),
        elecCurr: this.parseNumber(row[2]),
        elecUsage: this.parseNumber(row[6]),
        elecCost: this.parseNumber(row[7]),
        waterPrev: this.parseNumber(row[8]),
        waterCurr: this.parseNumber(row[9]),
        waterUsage: this.parseNumber(row[10]),
        waterCost: this.parseNumber(row[11]),
        gasPrev: this.parseNumber(row[12]),
        gasCurr: this.parseNumber(row[13]),
        gasUsage: this.parseNumber(row[14]),
        gasCost: this.parseNumber(row[15]),
      });
    }

    return results.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * 노무비 데이터 가져오기 (노무비 시트)
   * 날짜 형식: "2026. 1. 1." → "2026-01-01"
   */
  async fetchLabor(): Promise<LaborData[]> {
    const rows = await this.fetchSheetByName('노무비');
    const results: LaborData[] = [];

    // CSV 첫 행이 헤더, 데이터는 2행부터
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !row[1]) continue;

      // 날짜 정규화: "2026. 1. 1." → "2026-01-01"
      const rawDate = (row[1] || '').trim();
      const dateMatch = rawDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
      if (!dateMatch) continue;

      const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      const department = (row[2] || '').trim();
      if (!department) continue;

      results.push({
        week: row[0] || '',
        date,
        department,
        headcount: this.parseNumber(row[3]),
        weekdayRegularHours: this.parseNumber(row[4]),
        weekdayOvertimeHours: this.parseNumber(row[5]),
        weekdayNightHours: this.parseNumber(row[6]),
        weekdayTotalHours: this.parseNumber(row[7]),
        holidayRegularHours: this.parseNumber(row[8]),
        holidayOvertimeHours: this.parseNumber(row[9]),
        holidayNightHours: this.parseNumber(row[10]),
        holidayTotalHours: this.parseNumber(row[11]),
        weekdayRegularPay: this.parseNumber(row[12]),
        weekdayOvertimePay: this.parseNumber(row[13]),
        weekdayNightPay: this.parseNumber(row[14]),
        holidayRegularPay: this.parseNumber(row[15]),
        holidayOvertimePay: this.parseNumber(row[16]),
        holidayNightPay: this.parseNumber(row[17]),
        totalPay: this.parseNumber(row[18]),
      });
    }

    return results;
  }

  /**
   * BOM 데이터 가져오기 (3.SAN_BOM 또는 4.ZIP_BOM 시트)
   * BOM 스프레드시트에서 A~L열 파싱
   */
  async fetchBom(sheetName: string, source: 'SAN' | 'ZIP'): Promise<BomSheetData[]> {
    const rows = await this.fetchSheetByApi(BOM_SPREADSHEET_ID, sheetName);
    const results: BomSheetData[] = [];

    // 헤더가 2행, 데이터는 3행부터 (CSV 인덱스 기준 1부터 시작이므로 i=2)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const productCode = (row[0] || '').trim();
      if (!productCode) continue; // 빈 productCode 행 스킵

      results.push({
        source,
        productCode,
        productName: (row[1] || '').trim(),
        bomVersion: (row[2] || '').trim(),
        isExistingBom: (row[3] || '').trim() === 'Y' || (row[3] || '').trim() === '기존',
        productionQty: this.parseNumber(row[4]),
        materialCode: (row[5] || '').trim(),
        materialName: (row[6] || '').trim(),
        materialBomVersion: (row[7] || '').trim(),
        consumptionQty: this.parseNumber(row[8]),
        location: (row[9] || '').trim(),
        remark: (row[10] || '').trim(),
        additionalQty: this.parseNumber(row[11]),
      });
    }

    return results;
  }

  /**
   * 자재 마스터 데이터 가져오기 (1.자재정보 시트)
   * BOM 스프레드시트에서 A~P열 파싱
   */
  async fetchMaterialMaster(): Promise<MaterialMasterData[]> {
    const rows = await this.fetchSheetByName('1.자재정보', BOM_SPREADSHEET_ID);
    const results: MaterialMasterData[] = [];

    // 헤더가 2행, 데이터는 3행부터 (CSV 인덱스 기준 i=2)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const materialCode = (row[3] || '').trim();
      if (!materialCode) continue; // 빈 자재코드 행 스킵

      results.push({
        no: this.parseNumber(row[0]),
        category: (row[1] || '').trim(),
        issueType: (row[2] || '').trim(),
        materialCode,
        materialName: (row[4] || '').trim(),
        preprocessYield: this.parseNumber(row[5]),
        spec: (row[6] || '').trim(),
        unit: (row[7] || '').trim(),
        unitPrice: this.parseNumber(row[8]),
        safetyStock: this.parseNumber(row[9]),
        excessStock: this.parseNumber(row[10]),
        leadTimeDays: Math.round(this.parseNumber(row[11])),
        recentOutputQty: this.parseNumber(row[12]),
        dailyAvg: this.parseNumber(row[13]),
        note: (row[14] || '').trim(),
        inUse: (row[15] || '').trim() !== 'N' && (row[15] || '').trim() !== '미사용',
      });
    }

    return results;
  }

  /**
   * 모든 데이터 동기화
   */
  async syncAllData() {
    console.log('Syncing Google Sheet data...');

    const [dailySales, salesDetail, production, purchases, utilities, labor, sanBom, zipBom] = await Promise.all([
      this.fetchDailySales(),
      this.fetchSalesDetail(),
      this.fetchProduction(),
      this.fetchPurchases(),
      this.fetchUtilities(),
      this.fetchLabor(),
      this.fetchBom('3. SAN_BOM', 'SAN'),
      this.fetchBom('4. ZIP_BOM', 'ZIP'),
    ]);

    console.log('Google Sheet sync complete:', {
      dailySales: dailySales.length,
      salesDetail: salesDetail.length,
      production: production.length,
      purchases: purchases.length,
      utilities: utilities.length,
      labor: labor.length,
      sanBom: sanBom.length,
      zipBom: zipBom.length,
    });

    return {
      dailySales,
      salesDetail,
      production,
      purchases,
      utilities,
      labor,
      sanBom,
      zipBom,
      syncedAt: new Date().toISOString(),
    };
  }
}

export const googleSheetAdapter = new GoogleSheetAdapter();
