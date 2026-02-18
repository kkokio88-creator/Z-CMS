import type { ViewType } from '../contexts/UIContext';

interface ViewMeta {
  title: string;
  icon: string;
}

export const VIEW_CONFIG: Record<ViewType, ViewMeta> = {
  home: { title: '통합 관제 대시보드', icon: 'dashboard' },
  profit: { title: '수익 분석', icon: 'payments' },
  sales: { title: '매출 분석', icon: 'analytics' },
  cost: { title: '원가 관리', icon: 'account_balance' },
  production: { title: '생산/BOM 관리', icon: 'precision_manufacturing' },
  inventory: { title: '재고/발주 관리', icon: 'inventory_2' },
  settings: { title: '시스템 설정', icon: 'settings' },
};

export function getPageTitle(view: ViewType): string {
  return VIEW_CONFIG[view]?.title ?? '대시보드';
}
