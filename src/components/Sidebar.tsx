import React from 'react';

type ViewType =
  | 'home'
  | 'profit'
  | 'waste'
  | 'inventory'
  | 'stocktake'
  | 'monthly'
  | 'settings'
  | 'order'
  | 'costreport'
  | 'costmgmt'
  | 'bomaudit'
  | 'priceimpact'
  | 'dailyperformance'
  | 'budgetexpense'
  | 'statorder';

interface DataAvailability {
  sales: boolean;
  purchases: boolean;
  inventory: boolean;
  production: boolean;
  bom: boolean;
}

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  dataAvailability?: DataAvailability;
}

const NavItem = ({
  icon,
  label,
  isActive = false,
  onClick,
  hasData = true,
  noDataMessage,
}: {
  icon: string;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  hasData?: boolean;
  noDataMessage?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md group transition-colors mb-1 ${
      isActive
        ? 'bg-primary/10 text-primary dark:text-green-400'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}
    title={!hasData ? noDataMessage : undefined}
  >
    <span
      className={`material-icons-outlined mr-3 ${
        isActive ? 'text-primary dark:text-green-400' : 'text-gray-400 group-hover:text-gray-500'
      }`}
    >
      {icon}
    </span>
    <span className="flex-1 text-left">{label}</span>
  </button>
);

const NavSection = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="mt-4">
    <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {title}
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, dataAvailability }) => {
  // Determine which views have data based on dataAvailability
  const hasSalesData = dataAvailability?.sales ?? false;
  const hasInventoryData = dataAvailability?.inventory ?? false;
  const hasBomData = dataAvailability?.bom ?? false;
  const hasProductionData = dataAvailability?.production ?? false;

  return (
    <aside className="w-64 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-700 flex flex-col hidden md:flex shrink-0 transition-colors duration-200 h-full">
      <div
        className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
        onClick={() => onNavigate('home')}
      >
        <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          Z-CMS <span className="material-icons-outlined text-sm text-gray-400">expand_more</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
        <NavSection title="메인">
          <NavItem
            icon="dashboard"
            label="통합 관제 대시보드"
            isActive={activeView === 'home'}
            onClick={() => onNavigate('home')}
          />
        </NavSection>

        <NavSection title="수익 분석">
          <NavItem
            icon="grid_view"
            label="채널 손익 대시보드"
            isActive={activeView === 'profit'}
            onClick={() => onNavigate('profit')}
            hasData={hasSalesData}
            noDataMessage="판매 API 미지원"
          />
          <NavItem
            icon="leaderboard"
            label="월간 수익성 랭킹"
            isActive={activeView === 'monthly'}
            onClick={() => onNavigate('monthly')}
            hasData={hasSalesData}
            noDataMessage="판매 API 미지원"
          />
          <NavItem
            icon="assessment"
            label="원가 리포트"
            isActive={activeView === 'costreport'}
            onClick={() => onNavigate('costreport')}
          />
          <NavItem
            icon="account_balance"
            label="종합 원가관리"
            isActive={activeView === 'costmgmt'}
            onClick={() => onNavigate('costmgmt')}
          />
        </NavSection>

        <NavSection title="원가관리">
          <NavItem
            icon="rule"
            label="BOM 정합성 검토"
            isActive={activeView === 'bomaudit'}
            onClick={() => onNavigate('bomaudit')}
            hasData={hasBomData || hasProductionData}
            noDataMessage="BOM/생산 데이터 필요"
          />
          <NavItem
            icon="trending_up"
            label="단가 변동 분석"
            isActive={activeView === 'priceimpact'}
            onClick={() => onNavigate('priceimpact')}
            hasData={hasSalesData}
            noDataMessage="매입 데이터 필요"
          />
          <NavItem
            icon="speed"
            label="일일 달성률"
            isActive={activeView === 'dailyperformance'}
            onClick={() => onNavigate('dailyperformance')}
            hasData={hasProductionData}
            noDataMessage="생산 데이터 필요"
          />
          <NavItem
            icon="account_balance_wallet"
            label="예산/경비 관리"
            isActive={activeView === 'budgetexpense'}
            onClick={() => onNavigate('budgetexpense')}
          />
        </NavSection>

        <NavSection title="생산 관리">
          <NavItem
            icon="analytics"
            label="폐기 및 BOM 차이"
            isActive={activeView === 'waste'}
            onClick={() => onNavigate('waste')}
            hasData={hasBomData || hasProductionData}
            noDataMessage="생산/BOM API 미지원"
          />
          <NavItem
            icon="fact_check"
            label="재고 실사 이상 징후"
            isActive={activeView === 'stocktake'}
            onClick={() => onNavigate('stocktake')}
            hasData={hasInventoryData}
            noDataMessage="재고 데이터 기반"
          />
        </NavSection>

        <NavSection title="재고/구매 관리">
          <NavItem
            icon="inventory_2"
            label="안전재고 및 회전율"
            isActive={activeView === 'inventory'}
            onClick={() => onNavigate('inventory')}
            hasData={hasInventoryData}
          />
          <NavItem
            icon="shopping_cart"
            label="자재 발주 관리"
            isActive={activeView === 'order'}
            onClick={() => onNavigate('order')}
            hasData={hasInventoryData}
          />
          <NavItem
            icon="calculate"
            label="통계적 발주 (MRP)"
            isActive={activeView === 'statorder'}
            onClick={() => onNavigate('statorder')}
          />
        </NavSection>

        <NavSection title="시스템">
          <NavItem
            icon="settings"
            label="설정 (AI/기준)"
            isActive={activeView === 'settings'}
            onClick={() => onNavigate('settings')}
          />
        </NavSection>
      </nav>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center w-full">
          <img
            src="https://picsum.photos/100/100"
            alt="User Avatar"
            className="h-9 w-9 rounded-full object-cover border border-gray-200 dark:border-gray-600"
          />
          <div className="ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">박종철</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">생산 관리자</p>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <span className="material-icons-outlined">settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
