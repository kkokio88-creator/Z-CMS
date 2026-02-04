import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export interface CostReportData {
  sales: SheetRow[];      // DB_매출
  expenses: SheetRow[];   // DB_경비
  labor: SheetRow[];      // DB_노무비
  waste: SheetRow[];      // DB_폐기
}

export interface SheetRow {
  [key: string]: string | number;
}

export interface MonthlyCostSummary {
  month: string;           // YYYY-MM format
  salesAmount: number;     // 매출액
  expenseAmount: number;   // 경비
  laborCost: number;       // 노무비
  wasteCost: number;       // 폐기비용
  totalCost: number;       // 총 원가 (경비 + 노무비 + 폐기)
  profitRatio: number;     // 생산매출/원가액 비율
}

export interface CostTarget {
  month: string;
  targetRatio: number;     // 목표 생산매출/원가액 비율
  targetSales?: number;
  targetCost?: number;
}

export class GoogleSheetsAdapter {
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string;
  private credentials: any = null;

  constructor(spreadsheetId: string = '1GUo9wmwmm14zhb_gtpoNrDBfJ5DqEm5pf4jpRsto-JI') {
    this.spreadsheetId = spreadsheetId;
  }

  setCredentials(credentials: any): void {
    this.credentials = credentials;
    this.sheets = null; // Reset to reconnect with new credentials
  }

  private async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;

    // Method 1: Try service account JSON key file first
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    if (serviceAccountPath) {
      try {
        const keyFilePath = path.resolve(serviceAccountPath);
        console.log(`Loading service account from: ${keyFilePath}`);

        if (fs.existsSync(keyFilePath)) {
          const keyFileContent = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));

          const auth = new google.auth.GoogleAuth({
            credentials: keyFileContent,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });

          const authClient = await auth.getClient();
          this.sheets = google.sheets({
            version: 'v4',
            auth: authClient as any,
          });
          console.log('Google Sheets connected via service account');
          return this.sheets;
        } else {
          console.warn(`Service account key file not found: ${keyFilePath}`);
        }
      } catch (error: any) {
        console.error('Error loading service account:', error.message);
      }
    }

    // Method 2: Try API key (for public spreadsheets)
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.sheets = google.sheets({
        version: 'v4',
        auth: apiKey,
      });
      console.log('Google Sheets connected via API key');
      return this.sheets;
    }

    // Method 3: Use programmatically set credentials
    if (this.credentials) {
      const auth = new google.auth.GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const authClient = await auth.getClient();
      this.sheets = google.sheets({
        version: 'v4',
        auth: authClient as any,
      });
      return this.sheets;
    }

    throw new Error('Google Sheets credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_API_KEY in .env');
  }

  async fetchSheetData(sheetName: string): Promise<SheetRow[]> {
    try {
      const client = await this.getClient();

      const response = await client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`, // Fetch all columns
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log(`No data found in sheet: ${sheetName}`);
        return [];
      }

      // First row is headers
      const headers = rows[0] as string[];
      const dataRows = rows.slice(1);

      return dataRows.map(row => {
        const obj: SheetRow = {};
        headers.forEach((header, idx) => {
          const value = row[idx] || '';
          // Try to parse as number
          const numValue = parseFloat(value.toString().replace(/,/g, ''));
          obj[header] = isNaN(numValue) ? value : numValue;
        });
        return obj;
      });
    } catch (error: any) {
      console.error(`Error fetching sheet ${sheetName}:`, error.message);
      return [];
    }
  }

  async fetchAllCostData(): Promise<CostReportData> {
    console.log('Fetching cost data from Google Sheets...');

    const [sales, expenses, labor, waste] = await Promise.all([
      this.fetchSheetData('DB_매출'),
      this.fetchSheetData('DB_경비'),
      this.fetchSheetData('DB_노무비'),
      this.fetchSheetData('DB_폐기'),
    ]);

    console.log(`Fetched: 매출 ${sales.length}, 경비 ${expenses.length}, 노무비 ${labor.length}, 폐기 ${waste.length} rows`);

    return { sales, expenses, labor, waste };
  }

  // Calculate monthly cost summary from raw data
  calculateMonthlySummary(data: CostReportData): MonthlyCostSummary[] {
    const monthlyData = new Map<string, MonthlyCostSummary>();

    // Helper to extract month from date field
    const getMonth = (row: SheetRow): string | null => {
      // Try common date field names
      const dateFields = ['날짜', '일자', 'date', 'Date', '년월', '월'];
      for (const field of dateFields) {
        if (row[field]) {
          const dateStr = row[field].toString();
          // Try to extract YYYY-MM format
          const match = dateStr.match(/(\d{4})[-\/.]?(\d{2})/);
          if (match) {
            return `${match[1]}-${match[2]}`;
          }
        }
      }
      return null;
    };

    // Helper to get amount from row
    const getAmount = (row: SheetRow): number => {
      const amountFields = ['금액', '매출액', '비용', '원가', 'amount', 'Amount', '합계'];
      for (const field of amountFields) {
        if (row[field] !== undefined) {
          const val = row[field];
          return typeof val === 'number' ? val : parseFloat(val.toString().replace(/,/g, '')) || 0;
        }
      }
      return 0;
    };

    // Process sales
    data.sales.forEach(row => {
      const month = getMonth(row);
      if (!month) return;

      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          month,
          salesAmount: 0,
          expenseAmount: 0,
          laborCost: 0,
          wasteCost: 0,
          totalCost: 0,
          profitRatio: 0,
        });
      }
      monthlyData.get(month)!.salesAmount += getAmount(row);
    });

    // Process expenses
    data.expenses.forEach(row => {
      const month = getMonth(row);
      if (!month) return;

      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          month,
          salesAmount: 0,
          expenseAmount: 0,
          laborCost: 0,
          wasteCost: 0,
          totalCost: 0,
          profitRatio: 0,
        });
      }
      monthlyData.get(month)!.expenseAmount += getAmount(row);
    });

    // Process labor
    data.labor.forEach(row => {
      const month = getMonth(row);
      if (!month) return;

      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          month,
          salesAmount: 0,
          expenseAmount: 0,
          laborCost: 0,
          wasteCost: 0,
          totalCost: 0,
          profitRatio: 0,
        });
      }
      monthlyData.get(month)!.laborCost += getAmount(row);
    });

    // Process waste
    data.waste.forEach(row => {
      const month = getMonth(row);
      if (!month) return;

      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          month,
          salesAmount: 0,
          expenseAmount: 0,
          laborCost: 0,
          wasteCost: 0,
          totalCost: 0,
          profitRatio: 0,
        });
      }
      monthlyData.get(month)!.wasteCost += getAmount(row);
    });

    // Calculate totals and ratios
    const summaries = Array.from(monthlyData.values()).map(summary => {
      summary.totalCost = summary.expenseAmount + summary.laborCost + summary.wasteCost;
      // 생산매출/원가액 비율 (목표: 이 값이 높을수록 좋음)
      summary.profitRatio = summary.totalCost > 0
        ? parseFloat((summary.salesAmount / summary.totalCost).toFixed(2))
        : 0;
      return summary;
    });

    // Sort by month
    return summaries.sort((a, b) => a.month.localeCompare(b.month));
  }

  async testConnection(): Promise<{ success: boolean; message: string; sheetNames?: string[] }> {
    try {
      const client = await this.getClient();

      const response = await client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheetNames = response.data.sheets?.map(s => s.properties?.title || '') || [];

      return {
        success: true,
        message: `연결 성공: ${response.data.properties?.title}`,
        sheetNames,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `연결 실패: ${error.message}`,
      };
    }
  }
}

// ============================================
// 원가 분석용 확장 데이터 타입
// ============================================

export interface SalesTransaction {
  date: string;
  customerCode: string;
  customerName: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  channel?: string;
  warehouse?: string;
}

export interface PurchaseTransaction {
  date: string;
  supplierCode: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;  // 매입단가 = 원가 proxy
  amount: number;
  warehouse?: string;
}

export interface BomItem {
  parentItemCode: string;
  parentItemName: string;
  childItemCode: string;
  childItemName: string;
  requiredQuantity: number;
  unit?: string;
  level?: number;
}

export interface CostAnalysisData {
  sales: SalesTransaction[];
  purchases: PurchaseTransaction[];
  bom: BomItem[];
  fetchedAt: string;
}

// ============================================
// 멀티 스프레드시트 어댑터
// ============================================

export class MultiSpreadsheetAdapter {
  private baseAdapter: GoogleSheetsAdapter;
  private _salesPurchaseSpreadsheetId: string | null = null;
  private _bomSpreadsheetId: string | null = null;

  constructor() {
    this.baseAdapter = new GoogleSheetsAdapter();
  }

  // Lazy load env vars (in case dotenv hasn't run yet at module load time)
  private get salesPurchaseSpreadsheetId(): string {
    if (this._salesPurchaseSpreadsheetId === null) {
      this._salesPurchaseSpreadsheetId = process.env.GOOGLE_SALES_PURCHASE_SPREADSHEET_ID || '';
    }
    return this._salesPurchaseSpreadsheetId;
  }

  private get bomSpreadsheetId(): string {
    if (this._bomSpreadsheetId === null) {
      this._bomSpreadsheetId = process.env.GOOGLE_BOM_SPREADSHEET_ID || '';
    }
    return this._bomSpreadsheetId;
  }

  private async getClient(): Promise<sheets_v4.Sheets> {
    // Reuse the base adapter's client initialization logic
    return (this.baseAdapter as any).getClient();
  }

  async fetchSheetData(spreadsheetId: string, sheetName: string): Promise<SheetRow[]> {
    try {
      const client = await this.getClient();

      const response = await client.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log(`No data found in sheet: ${sheetName} (spreadsheet: ${spreadsheetId})`);
        return [];
      }

      const headers = rows[0] as string[];
      const dataRows = rows.slice(1);

      return dataRows.map(row => {
        const obj: SheetRow = {};
        headers.forEach((header, idx) => {
          const value = row[idx] || '';
          const numValue = parseFloat(value.toString().replace(/,/g, ''));
          obj[header] = isNaN(numValue) ? value : numValue;
        });
        return obj;
      });
    } catch (error: any) {
      console.error(`Error fetching sheet ${sheetName}:`, error.message);
      return [];
    }
  }

  async listSheets(spreadsheetId: string): Promise<string[]> {
    try {
      const client = await this.getClient();
      const response = await client.spreadsheets.get({ spreadsheetId });
      return response.data.sheets?.map(s => s.properties?.title || '') || [];
    } catch (error: any) {
      console.error(`Error listing sheets:`, error.message);
      return [];
    }
  }

  async fetchSalesTransactions(): Promise<SalesTransaction[]> {
    if (!this.salesPurchaseSpreadsheetId) {
      console.warn('Sales/Purchase spreadsheet ID not configured');
      return [];
    }

    // Try different sheet names for sales data
    const possibleSheetNames = ['판매현황', '판매', 'Sales', 'DB_판매', '매출'];
    const sheets = await this.listSheets(this.salesPurchaseSpreadsheetId);
    console.log(`[MultiSpreadsheetAdapter] 판매/구매 시트 목록: ${sheets.join(', ')}`);

    let salesSheet = sheets.find(s => possibleSheetNames.some(n => s.includes(n)));
    if (!salesSheet && sheets.length > 0) {
      // Use first sheet if no match found
      salesSheet = sheets[0];
    }

    if (!salesSheet) {
      console.warn('No sales sheet found');
      return [];
    }

    console.log(`[MultiSpreadsheetAdapter] 판매 시트 사용: ${salesSheet}`);
    const rawData = await this.fetchSheetData(this.salesPurchaseSpreadsheetId, salesSheet);

    return rawData.map(row => ({
      date: String(row['일자'] || row['날짜'] || row['date'] || ''),
      customerCode: String(row['거래처코드'] || row['거래처 코드'] || ''),
      customerName: String(row['거래처'] || row['거래처명'] || row['customer'] || ''),
      itemCode: String(row['품목코드'] || row['품목 코드'] || row['품번'] || ''),
      itemName: String(row['품목'] || row['품목명'] || row['품명'] || ''),
      quantity: Number(row['수량'] || row['판매수량'] || 0),
      unitPrice: Number(row['단가'] || row['판매단가'] || 0),
      amount: Number(row['금액'] || row['공급가액'] || row['매출액'] || 0),
      channel: String(row['채널'] || row['판매채널'] || ''),
      warehouse: String(row['창고'] || row['출고창고'] || ''),
    }));
  }

  async fetchPurchaseTransactions(): Promise<PurchaseTransaction[]> {
    if (!this.salesPurchaseSpreadsheetId) {
      console.warn('Sales/Purchase spreadsheet ID not configured');
      return [];
    }

    const possibleSheetNames = ['구매현황', '구매', 'Purchase', 'DB_구매', '매입'];
    const sheets = await this.listSheets(this.salesPurchaseSpreadsheetId);

    let purchaseSheet = sheets.find(s => possibleSheetNames.some(n => s.includes(n)));
    if (!purchaseSheet) {
      // Try second sheet
      purchaseSheet = sheets[1] || sheets[0];
    }

    if (!purchaseSheet) {
      console.warn('No purchase sheet found');
      return [];
    }

    console.log(`[MultiSpreadsheetAdapter] 구매 시트 사용: ${purchaseSheet}`);
    const rawData = await this.fetchSheetData(this.salesPurchaseSpreadsheetId, purchaseSheet);

    return rawData.map(row => ({
      date: String(row['일자'] || row['날짜'] || row['date'] || ''),
      supplierCode: String(row['거래처코드'] || row['거래처 코드'] || ''),
      supplierName: String(row['거래처'] || row['거래처명'] || row['공급업체'] || ''),
      itemCode: String(row['품목코드'] || row['품목 코드'] || row['품번'] || ''),
      itemName: String(row['품목'] || row['품목명'] || row['품명'] || ''),
      quantity: Number(row['수량'] || row['구매수량'] || 0),
      unitPrice: Number(row['단가'] || row['매입단가'] || row['구매단가'] || 0),
      amount: Number(row['금액'] || row['공급가액'] || row['매입액'] || 0),
      warehouse: String(row['창고'] || row['입고창고'] || ''),
    }));
  }

  async fetchBomData(): Promise<BomItem[]> {
    if (!this.bomSpreadsheetId) {
      console.warn('BOM spreadsheet ID not configured');
      return [];
    }

    const sheets = await this.listSheets(this.bomSpreadsheetId);
    console.log(`[MultiSpreadsheetAdapter] BOM 시트 목록: ${sheets.join(', ')}`);

    // Try to find BOM sheet
    const possibleSheetNames = ['BOM', 'bom', '자재명세서', '소요량', 'DB_BOM'];
    let bomSheet = sheets.find(s => possibleSheetNames.some(n => s.toLowerCase().includes(n.toLowerCase())));
    if (!bomSheet && sheets.length > 0) {
      bomSheet = sheets[0];
    }

    if (!bomSheet) {
      console.warn('No BOM sheet found');
      return [];
    }

    console.log(`[MultiSpreadsheetAdapter] BOM 시트 사용: ${bomSheet}`);
    const rawData = await this.fetchSheetData(this.bomSpreadsheetId, bomSheet);

    return rawData.map(row => ({
      parentItemCode: String(row['모품목코드'] || row['완제품코드'] || row['생산품목코드'] || row['상위품목'] || ''),
      parentItemName: String(row['모품목명'] || row['완제품명'] || row['생산품목'] || row['상위품명'] || ''),
      childItemCode: String(row['자품목코드'] || row['원자재코드'] || row['소요품목코드'] || row['하위품목'] || ''),
      childItemName: String(row['자품목명'] || row['원자재명'] || row['소요품목'] || row['하위품명'] || ''),
      requiredQuantity: Number(row['소요량'] || row['필요수량'] || row['수량'] || 1),
      unit: String(row['단위'] || ''),
      level: Number(row['레벨'] || row['단계'] || 1),
    }));
  }

  async fetchAllCostAnalysisData(): Promise<CostAnalysisData> {
    console.log('[MultiSpreadsheetAdapter] 원가 분석 데이터 수집 시작...');

    const [sales, purchases, bom] = await Promise.all([
      this.fetchSalesTransactions(),
      this.fetchPurchaseTransactions(),
      this.fetchBomData(),
    ]);

    console.log(`[MultiSpreadsheetAdapter] 수집 완료: 판매 ${sales.length}, 구매 ${purchases.length}, BOM ${bom.length} 건`);

    return {
      sales,
      purchases,
      bom,
      fetchedAt: new Date().toISOString(),
    };
  }

  async testConnections(): Promise<{ costSheet: boolean; bomSheet: boolean; details: string }> {
    let costSheet = false;
    let bomSheet = false;
    const details: string[] = [];

    try {
      if (this.salesPurchaseSpreadsheetId) {
        const sheets = await this.listSheets(this.salesPurchaseSpreadsheetId);
        costSheet = sheets.length > 0;
        details.push(`판매/구매 시트: ${sheets.join(', ')}`);
      } else {
        details.push('판매/구매 스프레드시트 ID 미설정');
      }
    } catch (e: any) {
      details.push(`판매/구매 연결 실패: ${e.message}`);
    }

    try {
      if (this.bomSpreadsheetId) {
        const sheets = await this.listSheets(this.bomSpreadsheetId);
        bomSheet = sheets.length > 0;
        details.push(`BOM 시트: ${sheets.join(', ')}`);
      } else {
        details.push('BOM 스프레드시트 ID 미설정');
      }
    } catch (e: any) {
      details.push(`BOM 연결 실패: ${e.message}`);
    }

    return { costSheet, bomSheet, details: details.join('\n') };
  }
}

export const googleSheetsAdapter = new GoogleSheetsAdapter();
export const multiSpreadsheetAdapter = new MultiSpreadsheetAdapter();
