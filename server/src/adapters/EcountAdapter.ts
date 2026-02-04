import type {
  EcountConfig,
  EcountSaleRaw,
  EcountInventoryRaw,
  EcountProductionRaw,
  EcountBomRaw,
  EcountPurchaseRaw,
} from '../types/index.js';

interface EcountApiResponse<T> {
  Data?: {
    Result: T[];
    TotalCount?: number;
  };
  Status: string;
  Error?: {
    Code: string;
    Message: string;
  };
}

export class EcountAdapter {
  private config: EcountConfig;
  private sessionId: string | null = null;

  constructor() {
    this.config = {
      COM_CODE: process.env.ECOUNT_COM_CODE || '',
      USER_ID: process.env.ECOUNT_USER_ID || '',
      API_KEY: process.env.ECOUNT_API_KEY || '',
      ZONE: process.env.ECOUNT_ZONE || 'CD',
    };
  }

  updateConfig(config: Partial<EcountConfig>): void {
    this.config = { ...this.config, ...config };
    this.sessionId = null;
  }

  getConfig(): Omit<EcountConfig, 'API_KEY'> {
    return {
      COM_CODE: this.config.COM_CODE,
      USER_ID: this.config.USER_ID,
      ZONE: this.config.ZONE,
    };
  }

  private getBaseUrl(): string {
    return `https://oapi${this.config.ZONE}.ecount.com/OAPI/V2`;
  }

  async login(): Promise<boolean> {
    const url = `${this.getBaseUrl()}/OAPILogin`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          COM_CODE: this.config.COM_CODE,
          USER_ID: this.config.USER_ID,
          API_CERT_KEY: this.config.API_KEY,
          LAN_TYPE: 'ko-KR',
          ZONE: this.config.ZONE,
        }),
      });

      const data = await response.json();

      if (data.Data?.Datas?.SESSION_ID) {
        this.sessionId = data.Data.Datas.SESSION_ID;
        console.log('ECOUNT login successful');
        return true;
      }

      console.error('ECOUNT login failed:', data);
      return false;
    } catch (error) {
      console.error('ECOUNT login error:', error);
      return false;
    }
  }

  private async callApi<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T[]> {
    if (!this.sessionId) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('ECOUNT login failed');
      }
    }

    const url = `${this.getBaseUrl()}${endpoint}?SESSION_ID=${this.sessionId}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          PageSize: 5000,
        }),
      });

      const data: EcountApiResponse<T> = await response.json();

      if (data.Error?.Code === '999') {
        console.log('Session expired, re-logging in...');
        this.sessionId = null;
        return this.callApi(endpoint, params);
      }

      if (data.Status !== '200' || !data.Data?.Result) {
        console.warn(`ECOUNT API warning for ${endpoint}:`, data);
        return [];
      }

      return data.Data.Result;
    } catch (error) {
      console.error(`ECOUNT API error for ${endpoint}:`, error);
      return [];
    }
  }

  // Try multiple endpoints until one works
  private async tryEndpoints<T>(
    endpoints: { path: string; params: Record<string, unknown> }[],
    name: string
  ): Promise<T[]> {
    for (const { path, params } of endpoints) {
      try {
        const result = await this.callApi<T>(path, params);
        if (result.length > 0) {
          console.log(`✓ ${name}: ${path} returned ${result.length} items`);
          return result;
        }
      } catch (e) {
        // Continue to next endpoint
      }
    }
    console.log(`✗ ${name}: No working endpoint found`);
    return [];
  }

  async fetchSales(dateFrom: string, dateTo: string): Promise<EcountSaleRaw[]> {
    // ECOUNT OAPI V2: 다양한 판매 조회 엔드포인트 시도
    const endpoints = [
      { path: '/SaleIO/GetListSaleIO', params: { IO_DATE_FROM: dateFrom, IO_DATE_TO: dateTo } },
      { path: '/Sale/GetListSale', params: { SALE_DATE_FROM: dateFrom, SALE_DATE_TO: dateTo } },
      {
        path: '/SaleSlip/GetListSaleSlip',
        params: { SALE_DATE_FROM: dateFrom, SALE_DATE_TO: dateTo },
      },
      {
        path: '/SaleSlipIO/GetListSaleSlipIO',
        params: { IO_DATE_FROM: dateFrom, IO_DATE_TO: dateTo },
      },
      { path: '/Sale/GetSaleList', params: { FROM_DATE: dateFrom, TO_DATE: dateTo } },
    ];
    return this.tryEndpoints<EcountSaleRaw>(endpoints, '판매');
  }

  async fetchPurchases(dateFrom: string, dateTo: string): Promise<EcountPurchaseRaw[]> {
    // ECOUNT OAPI V2: 다양한 구매/발주 조회 엔드포인트 시도
    const endpoints = [
      {
        path: '/PurchaseIO/GetListPurchaseIO',
        params: { IO_DATE_FROM: dateFrom, IO_DATE_TO: dateTo },
      },
      {
        path: '/Purchases/GetListPurchases',
        params: { PURCHASE_DATE_FROM: dateFrom, PURCHASE_DATE_TO: dateTo },
      },
      {
        path: '/PurchasesSlip/GetListPurchasesSlip',
        params: { PURCHASE_DATE_FROM: dateFrom, PURCHASE_DATE_TO: dateTo },
      },
      {
        path: '/PurchaseOrder/GetListPurchaseOrder',
        params: { ORDER_DATE_FROM: dateFrom, ORDER_DATE_TO: dateTo },
      },
      { path: '/PO/GetListPO', params: { FROM_DATE: dateFrom, TO_DATE: dateTo } },
    ];
    return this.tryEndpoints<EcountPurchaseRaw>(endpoints, '구매');
  }

  async fetchInventory(): Promise<EcountInventoryRaw[]> {
    // ECOUNT OAPI V2: 재고 현황 조회 (창고+품목별) - 이미 작동함
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return this.callApi<EcountInventoryRaw>(
      '/InventoryBalance/GetListInventoryBalanceStatusByLocation',
      {
        BASE_DATE: today,
      }
    );
  }

  async fetchProduction(dateFrom: string, dateTo: string): Promise<EcountProductionRaw[]> {
    // ECOUNT OAPI V2: 다양한 생산 조회 엔드포인트 시도
    const endpoints = [
      {
        path: '/ProductionIO/GetListProductionIO',
        params: { IO_DATE_FROM: dateFrom, IO_DATE_TO: dateTo },
      },
      {
        path: '/Production/GetListProduction',
        params: { PROD_DATE_FROM: dateFrom, PROD_DATE_TO: dateTo },
      },
      {
        path: '/ProductionSlip/GetListProductionSlip',
        params: { PROD_DATE_FROM: dateFrom, PROD_DATE_TO: dateTo },
      },
      {
        path: '/ProductionOrder/GetListProductionOrder',
        params: { ORDER_DATE_FROM: dateFrom, ORDER_DATE_TO: dateTo },
      },
    ];
    return this.tryEndpoints<EcountProductionRaw>(endpoints, '생산');
  }

  async fetchBom(): Promise<EcountBomRaw[]> {
    // ECOUNT OAPI V2: 다양한 BOM 조회 엔드포인트 시도
    const endpoints = [
      { path: '/BOM/GetListBOM', params: {} },
      { path: '/InventoryBasic/GetBasicBOM', params: {} },
      { path: '/BOM/GetBOMList', params: {} },
      { path: '/ProductBOM/GetListProductBOM', params: {} },
    ];
    return this.tryEndpoints<EcountBomRaw>(endpoints, 'BOM');
  }

  async fetchProducts(): Promise<any[]> {
    // ECOUNT OAPI V2: 품목 마스터 조회 - 권한 있음
    return this.callApi<any>('/InventoryBasic/GetBasicProductsList', {});
  }

  // 발주서 조회 (Purchase Orders)
  async fetchPurchaseOrders(dateFrom: string, dateTo: string): Promise<any[]> {
    const endpoints = [
      {
        path: '/Purchases/GetPurchasesOrderList',
        params: { ORDER_DATE_FROM: dateFrom, ORDER_DATE_TO: dateTo },
      },
      {
        path: '/PurchaseOrder/GetListPurchaseOrder',
        params: { ORDER_DATE_FROM: dateFrom, ORDER_DATE_TO: dateTo },
      },
      { path: '/PO/GetListPO', params: { FROM_DATE: dateFrom, TO_DATE: dateTo } },
    ];
    return this.tryEndpoints<any>(endpoints, '발주서');
  }

  // 창고별 재고현황 (Inventory by Location)
  async fetchInventoryByLocation(baseDate?: string): Promise<any[]> {
    const date = baseDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const endpoints = [
      {
        path: '/InventoryBalance/GetListInventoryBalanceStatusByLocation',
        params: { BASE_DATE: date },
      },
      { path: '/InventoryBalance/GetInventoryBalanceByWH', params: { BASE_DATE: date } },
      { path: '/Inventory/GetListInventoryByWarehouse', params: { BASE_DATE: date } },
    ];
    return this.tryEndpoints<any>(endpoints, '창고별재고');
  }

  // 출퇴근 기록 조회 (Time Management - Attendance)
  async fetchAttendance(dateFrom: string, dateTo: string): Promise<any[]> {
    const endpoints = [
      { path: '/TimeMgmt/GetAttendanceList', params: { FROM_DATE: dateFrom, TO_DATE: dateTo } },
      { path: '/TimeMgmt/GetListClockInOut', params: { FROM_DATE: dateFrom, TO_DATE: dateTo } },
      {
        path: '/Attendance/GetListAttendance',
        params: { ATT_DATE_FROM: dateFrom, ATT_DATE_TO: dateTo },
      },
      { path: '/HR/GetAttendanceRecord', params: { FROM_DATE: dateFrom, TO_DATE: dateTo } },
    ];
    return this.tryEndpoints<any>(endpoints, '출퇴근');
  }

  // 급여 데이터 조회 (Payroll)
  async fetchPayroll(yearMonth: string): Promise<any[]> {
    const endpoints = [
      { path: '/Payroll/GetListPayroll', params: { YEAR_MONTH: yearMonth } },
      { path: '/HR/GetPayrollList', params: { YEAR_MONTH: yearMonth } },
      { path: '/Salary/GetListSalary', params: { PAY_MONTH: yearMonth } },
    ];
    return this.tryEndpoints<any>(endpoints, '급여');
  }

  // 거래처 조회 (Customers/Vendors)
  async fetchCustomers(): Promise<any[]> {
    const endpoints = [
      { path: '/SalesBasic/GetBasicCustomerList', params: {} },
      { path: '/Customer/GetListCustomer', params: {} },
      { path: '/Vendor/GetListVendor', params: {} },
    ];
    return this.tryEndpoints<any>(endpoints, '거래처');
  }

  async syncAllData() {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const dateFrom = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');
    const dateTo = today.toISOString().slice(0, 10).replace(/-/g, '');
    const currentYearMonth = today.toISOString().slice(0, 7).replace(/-/g, '');

    console.log(`Syncing ECOUNT data from ${dateFrom} to ${dateTo}...`);

    const [
      sales,
      purchases,
      inventory,
      production,
      bom,
      purchaseOrders,
      inventoryByLocation,
      attendance,
      customers,
    ] = await Promise.all([
      this.fetchSales(dateFrom, dateTo),
      this.fetchPurchases(dateFrom, dateTo),
      this.fetchInventory(),
      this.fetchProduction(dateFrom, dateTo),
      this.fetchBom(),
      this.fetchPurchaseOrders(dateFrom, dateTo),
      this.fetchInventoryByLocation(),
      this.fetchAttendance(dateFrom, dateTo),
      this.fetchCustomers(),
    ]);

    console.log(`ECOUNT sync complete:`, {
      sales: sales.length,
      purchases: purchases.length,
      inventory: inventory.length,
      production: production.length,
      bom: bom.length,
      purchaseOrders: purchaseOrders.length,
      inventoryByLocation: inventoryByLocation.length,
      attendance: attendance.length,
      customers: customers.length,
    });

    return {
      sales,
      purchases,
      inventory,
      production,
      bom,
      purchaseOrders,
      inventoryByLocation,
      attendance,
      customers,
      syncedAt: new Date().toISOString(),
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const success = await this.login();
      return {
        success,
        message: success ? '연결 성공' : '로그인 실패',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }
}

export const ecountAdapter = new EcountAdapter();
