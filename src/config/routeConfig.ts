import type { ViewType } from '../contexts/UIContext';
import { VIEW_CONFIG } from './viewConfig';

export interface RouteDefinition {
  path: string;
  view: ViewType;
  title: string;
  icon: string;
  tabs?: { key: string; path: string }[];
}

export const ROUTES: Record<ViewType, RouteDefinition> = {
  home: {
    path: '/',
    view: 'home',
    ...VIEW_CONFIG.home,
  },
  profit: {
    path: '/profit',
    view: 'profit',
    ...VIEW_CONFIG.profit,
    tabs: [
      { key: 'channel', path: 'channel' },
      { key: 'product', path: 'product' },
      { key: 'trend', path: 'trend' },
      { key: 'budget', path: 'budget' },
      { key: 'cashflow', path: 'cashflow' },
    ],
  },
  sales: {
    path: '/sales',
    view: 'sales',
    ...VIEW_CONFIG.sales,
    tabs: [
      { key: 'trend', path: 'trend' },
      { key: 'bestseller', path: 'bestseller' },
      { key: 'surge', path: 'surge' },
      { key: 'matrix', path: 'matrix' },
      { key: 'channel', path: 'channel' },
    ],
  },
  cost: {
    path: '/cost',
    view: 'cost',
    ...VIEW_CONFIG.cost,
    tabs: [
      { key: 'overview', path: 'overview' },
      { key: 'raw', path: 'raw' },
      { key: 'sub', path: 'sub' },
      { key: 'labor', path: 'labor' },
      { key: 'overhead', path: 'overhead' },
      { key: 'dailyPerformance', path: 'daily-performance' },
      { key: 'priceImpact', path: 'price-impact' },
      { key: 'budgetExpense', path: 'budget-expense' },
    ],
  },
  production: {
    path: '/production',
    view: 'production',
    ...VIEW_CONFIG.production,
    tabs: [
      { key: 'overview', path: 'overview' },
      { key: 'production', path: 'production' },
      { key: 'waste', path: 'waste' },
      { key: 'efficiency', path: 'efficiency' },
      { key: 'bomAnomaly', path: 'bom-anomaly' },
      { key: 'bomVariance', path: 'bom-variance' },
      { key: 'yield', path: 'yield' },
      { key: 'integrity', path: 'integrity' },
    ],
  },
  inventory: {
    path: '/inventory',
    view: 'inventory',
    ...VIEW_CONFIG.inventory,
    tabs: [
      { key: 'inventory', path: 'inventory' },
      { key: 'anomaly', path: 'anomaly' },
      { key: 'statistical', path: 'statistical' },
      { key: 'purchase', path: 'purchase' },
      { key: 'inventoryCost', path: 'inventory-cost' },
    ],
  },
  settings: {
    path: '/settings',
    view: 'settings',
    ...VIEW_CONFIG.settings,
  },
};

/** URL path → ViewType 역매핑 */
export function viewFromPath(pathname: string): ViewType {
  const segment = pathname.split('/')[1] || '';
  for (const route of Object.values(ROUTES)) {
    if (route.path === `/${segment}` || (segment === '' && route.path === '/')) {
      return route.view;
    }
  }
  return 'home';
}

/** ViewType → tab key에서 URL path segment 찾기 */
export function tabPathFromKey(view: ViewType, tabKey: string): string {
  const route = ROUTES[view];
  const tab = route.tabs?.find(t => t.key === tabKey);
  return tab?.path ?? tabKey;
}

/** URL path segment → tab key 찾기 */
export function tabKeyFromPath(view: ViewType, pathSegment: string): string | undefined {
  const route = ROUTES[view];
  const tab = route.tabs?.find(t => t.path === pathSegment);
  return tab?.key;
}
