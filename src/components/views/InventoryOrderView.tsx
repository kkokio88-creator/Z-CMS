import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  LineChart, Line, PieChart, Pie,
} from 'recharts';
import { SubTabLayout, Pagination } from '../layout';
import { usePagination } from '../../hooks/usePagination';
import { formatCurrency, formatAxisKRW, formatQty } from '../../utils/format';
import { InventorySafetyItem, StocktakeAnomalyItem } from '../../types';
import type { PurchaseData, InventorySnapshotData } from '../../services/googleSheetService';
import type { DashboardInsights, StatisticalOrderInsight, ABCXYZInsight, FreshnessInsight, FreshnessGrade, InventoryCostInsight } from '../../services/insightService';
import { computeStatisticalOrder, computeMaterialPrices } from '../../services/insightService';
import { useBusinessConfig } from '../../contexts/SettingsContext';
import { groupByWeek, weekKeyToLabel, getSortedWeekEntries } from '../../utils/weeklyAggregation';
import { useUI } from '../../contexts/UIContext';
import { getDateRange, filterByDate } from '../../utils/dateRange';
import { FormulaTooltip } from '../common';
import { FORMULAS } from '../../constants/formulaDescriptions';
import { InsightSection } from '../insight';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { DynamicIcon } from '../ui/icon';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Button } from '../ui/button';

interface Props {
  inventoryData: InventorySafetyItem[];
  purchases: PurchaseData[];
  insights: DashboardInsights | null;
  stocktakeAnomalies: StocktakeAnomalyItem[];
  inventorySnapshots?: InventorySnapshotData[];
  onItemClick: (item: import('../../types').ModalItem) => void;
  onTabChange?: (tab: string) => void;
}

const STATUS_COLORS = {
  shortage: '#EF4444',
  urgent: '#F59E0B',
  normal: '#10B981',
  overstock: '#3B82F6',
};

const STATUS_LABELS = {
  shortage: '부족',
  urgent: '긴급',
  normal: '정상',
  overstock: '과잉',
};

// 발주처 목록 (모의 데이터)
interface Supplier {
  id: string;
  name: string;
  method: 'email' | 'kakao' | 'ecount' | 'phone' | 'fax';
  methodLabel: string;
  leadTime: number;
  contact: string;
  icon: string;
}

/** 구매 데이터에서 공급업체 목록 동적 추출 */
function extractSuppliersFromPurchases(purchases: PurchaseData[]): Supplier[] {
  const supplierMap = new Map<string, { count: number; totalAmount: number; lastDate: string; products: Set<string> }>();
  for (const p of purchases) {
    const name = p.supplierName?.trim();
    if (!name) continue;
    const entry = supplierMap.get(name) || { count: 0, totalAmount: 0, lastDate: '', products: new Set() };
    entry.count++;
    entry.totalAmount += p.total || 0;
    if (p.date > entry.lastDate) entry.lastDate = p.date;
    if (p.productCode) entry.products.add(p.productCode);
    supplierMap.set(name, entry);
  }
  return [...supplierMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, info], idx) => ({
      id: `s${idx + 1}`,
      name,
      method: 'email' as const,
      methodLabel: '이메일',
      leadTime: 3,
      contact: '',
      icon: 'email',
    }));
}

/** 품목 코드 기반 발주처 배정 — 실제 거래 이력 우선, 없으면 해시 배정 */
function getSupplierForProduct(productCode: string, suppliers: Supplier[]): Supplier {
  if (suppliers.length === 0) {
    return { id: 's0', name: '미지정', method: 'email', methodLabel: '이메일', leadTime: 3, contact: '', icon: 'email' };
  }
  // 해시 기반 배정
  let hash = 0;
  for (let i = 0; i < productCode.length; i++) {
    hash = ((hash << 5) - hash) + productCode.charCodeAt(i);
    hash = hash & hash;
  }
  return suppliers[Math.abs(hash) % suppliers.length];
}

// 날짜 포맷 (YYYY-MM-DD)
function formatDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// 영업일 기반 입고예정일 계산
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) added++;
  }
  return result;
}

// 발주 모달 컴포넌트
const OrderModal: React.FC<{
  supplier: Supplier;
  productName: string;
  quantity: number;
  orderDate: string;
  deliveryDate: string;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ supplier, productName, quantity, orderDate, deliveryDate, onClose, onConfirm }) => {
  const methodColors: Record<string, string> = {
    email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    kakao: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    ecount: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    phone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    fax: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <DynamicIcon name="shopping_cart" size={20} className="text-blue-500" />
          발주 확인
        </h3>
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">품목</span>
            <span className="font-medium text-gray-900 dark:text-white">{productName}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">발주량</span>
            <span className="font-medium text-gray-900 dark:text-white">{quantity.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">발주처</span>
            <span className="font-medium text-gray-900 dark:text-white">{supplier.name}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">발주 방법</span>
            <Badge className={`${methodColors[supplier.method]} border-0`}>
              <DynamicIcon name={supplier.icon} size={12} className="mr-1" />
              {supplier.methodLabel}
            </Badge>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">연락처</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{supplier.contact}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">발주일</span>
            <span className="font-medium text-gray-900 dark:text-white">{orderDate}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">입고 예정일</span>
            <span className="font-bold text-blue-600">{deliveryDate}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-500">리드타임</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{supplier.leadTime}일 (영업일)</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button onClick={onConfirm} className="flex-1 gap-1">
            <DynamicIcon name={supplier.icon} size={16} />
            {supplier.methodLabel}로 발주
          </Button>
        </div>
      </div>
    </div>
  );
};

export const InventoryOrderView: React.FC<Props> = ({
  inventoryData,
  purchases,
  insights,
  stocktakeAnomalies,
  inventorySnapshots = [],
  onItemClick,
  onTabChange,
}) => {
  const config = useBusinessConfig();
  const { dateRange } = useUI();
  const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRange(dateRange), [dateRange]);
  const filteredPurchases = useMemo(() => filterByDate(purchases, rangeStart, rangeEnd), [purchases, rangeStart, rangeEnd]);

  // 구매 데이터에서 공급업체 동적 추출 (US-005)
  const suppliers = useMemo(() => extractSuppliersFromPurchases(purchases), [purchases]);

  // dateRange 기반 인사이트 로컬 재계산
  const materialPrices = useMemo(
    () => filteredPurchases.length > 0 ? computeMaterialPrices(filteredPurchases) : null,
    [filteredPurchases]
  );
  const [serviceLevel, setServiceLevel] = useState(95);
  const [orderDate, setOrderDate] = useState(formatDateStr(new Date()));
  const [orderModal, setOrderModal] = useState<{
    supplier: Supplier;
    productName: string;
    quantity: number;
    deliveryDate: string;
  } | null>(null);

  // 서비스 수준 변경 시 재계산 (filteredPurchases 기반)
  const statisticalOrder: StatisticalOrderInsight | null = useMemo(() => {
    if (inventoryData.length > 0 && filteredPurchases.length > 0) {
      return computeStatisticalOrder(inventoryData, filteredPurchases, config, serviceLevel);
    }
    return null;
  }, [inventoryData, filteredPurchases, serviceLevel, config]);

  const abcxyz = insights?.abcxyz || null;
  const freshness = insights?.freshness || null;

  const [invFilter, setInvFilter] = useState('all');
  const [anomalySort, setAnomalySort] = useState<'score' | 'diff'>('score');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [expandedAbc, setExpandedAbc] = useState<string | null>('A');
  const [invPage, setInvPage] = useState(1);
  const [statPage, setStatPage] = useState(1);
  const INV_PAGE_SIZE = 20;
  const STAT_PAGE_SIZE = 20;

  // D1: inventoryData 기반 이상징후 자동 생성
  const autoAnomalies: StocktakeAnomalyItem[] = useMemo(() => {
    if (stocktakeAnomalies.length > 0) return stocktakeAnomalies;
    return inventoryData
      .map((item) => {
        let score = 0;
        let reason = '';
        const deviation = item.safetyStock > 0
          ? Math.abs(item.currentStock - item.safetyStock) / item.safetyStock
          : 0;
        // 안전재고 대비 크게 벗어난 경우
        if (item.status === 'Shortage' && deviation > 0.3) {
          score += Math.min(Math.round(deviation * 60), 80);
          reason = `안전재고 대비 ${Math.round(deviation * 100)}% 부족`;
        } else if (item.status === 'Overstock' && deviation > 1) {
          score += Math.min(Math.round(deviation * 30), 60);
          reason = `안전재고 대비 ${Math.round(deviation * 100)}% 과잉`;
        }
        // 재고회전율 이상치
        if (item.turnoverRate < 0.3 && item.currentStock > 0) {
          score += 25;
          reason += (reason ? ' / ' : '') + `회전율 극저(${item.turnoverRate.toFixed(2)})`;
        } else if (item.turnoverRate > 10) {
          score += 15;
          reason += (reason ? ' / ' : '') + `회전율 과대(${item.turnoverRate.toFixed(1)})`;
        }
        if (score < 20) return null;
        return {
          id: item.id,
          materialName: item.skuName,
          location: item.warehouse || '-',
          systemQty: item.safetyStock,
          countedQty: item.currentStock,
          aiExpectedQty: item.safetyStock,
          anomalyScore: Math.min(score, 100),
          reason,
        } as StocktakeAnomalyItem;
      })
      .filter((x): x is StocktakeAnomalyItem => x !== null)
      .sort((a, b) => b.anomalyScore - a.anomalyScore);
  }, [inventoryData, stocktakeAnomalies]);

  const tabs = [
    { key: 'inventory', label: '재고 현황', icon: 'inventory_2' },
    { key: 'anomaly', label: '이상징후 분석', icon: 'warning' },
    { key: 'statistical', label: '통계적 발주', icon: 'calculate' },
    { key: 'purchase', label: '발주 분석', icon: 'shopping_cart' },
    { key: 'inventoryCost', label: '재고비용', icon: 'savings' },
  ];

  const handleOrder = (productName: string, productCode: string, quantity: number) => {
    const supplier = getSupplierForProduct(productCode, suppliers);
    const startDate = new Date(orderDate);
    const deliveryDate = addBusinessDays(startDate, supplier.leadTime);
    setOrderModal({
      supplier,
      productName,
      quantity,
      deliveryDate: formatDateStr(deliveryDate),
    });
  };

  const handleConfirmOrder = () => {
    if (orderModal) {
      const { supplier, productName, quantity } = orderModal;
      // 발주 방법에 따른 처리 (실제 구현 시 API 호출)
      switch (supplier.method) {
        case 'email':
          alert(`${supplier.name}에 이메일 발주가 전송됩니다.\n품목: ${productName}\n수량: ${quantity}\n수신: ${supplier.contact}`);
          break;
        case 'kakao':
          alert(`${supplier.name} 카카오톡 채널로 발주 메시지가 전송됩니다.\n품목: ${productName}\n수량: ${quantity}`);
          break;
        case 'ecount':
          alert(`ECOUNT ERP에 자동 발주가 등록됩니다.\n품목: ${productName}\n수량: ${quantity}\n발주처: ${supplier.name}`);
          break;
        case 'phone':
          alert(`전화 발주 안내:\n발주처: ${supplier.name}\n연락처: ${supplier.contact}\n품목: ${productName}\n수량: ${quantity}`);
          break;
        case 'fax':
          alert(`팩스 발주서가 전송됩니다.\n발주처: ${supplier.name}\n팩스: ${supplier.contact}\n품목: ${productName}\n수량: ${quantity}`);
          break;
      }
    }
    setOrderModal(null);
  };

  return (
    <>
      <SubTabLayout title="재고/발주 관리" tabs={tabs} onTabChange={onTabChange}>
        {(activeTab) => {
          // ========== 재고 현황 ==========
          if (activeTab === 'inventory') {
            const shortageCount = inventoryData.filter(i => i.status === 'Shortage').length;
            const overstockCount = inventoryData.filter(i => i.status === 'Overstock').length;
            const normalCount = inventoryData.filter(i => i.status === 'Normal').length;

            // 상태 필터 적용
            const filteredInventory = invFilter === 'all' ? inventoryData
              : invFilter === 'shortage' ? inventoryData.filter(i => i.status === 'Shortage')
              : invFilter === 'overstock' ? inventoryData.filter(i => i.status === 'Overstock')
              : inventoryData.filter(i => i.status === 'Normal');

            const riskItems = filteredInventory
              .filter(i => invFilter === 'all' ? i.status !== 'Normal' : true)
              .slice(0, 15)
              .map(i => ({
                name: i.skuName.length > 10 ? i.skuName.slice(0, 10) + '...' : i.skuName,
                현재재고: i.currentStock,
                안전재고: i.safetyStock,
                status: i.status,
              }));

            // 회전율 분포 데이터
            const turnoverDist = [
              { range: '0~0.5', count: inventoryData.filter(i => i.turnoverRate < 0.5).length, color: '#EF4444' },
              { range: '0.5~1', count: inventoryData.filter(i => i.turnoverRate >= 0.5 && i.turnoverRate < 1).length, color: '#F59E0B' },
              { range: '1~2', count: inventoryData.filter(i => i.turnoverRate >= 1 && i.turnoverRate < 2).length, color: '#3B82F6' },
              { range: '2~5', count: inventoryData.filter(i => i.turnoverRate >= 2 && i.turnoverRate < 5).length, color: '#10B981' },
              { range: '5+', count: inventoryData.filter(i => i.turnoverRate >= 5).length, color: '#8B5CF6' },
            ];

            // 상태 분포 파이 데이터
            const statusPie = [
              { name: '부족', value: shortageCount, color: '#EF4444' },
              { name: '과잉', value: overstockCount, color: '#F59E0B' },
              { name: '정상', value: normalCount, color: '#10B981' },
            ].filter(d => d.value > 0);

            return (
              <InsightSection id={["inv-freshness", "inv-order-summary"]}>
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">총 품목</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{inventoryData.length}건</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">부족</p>
                    <p className={`text-2xl font-bold mt-1 ${shortageCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{shortageCount}건</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">과잉</p>
                    <p className={`text-2xl font-bold mt-1 ${overstockCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{overstockCount}건</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">정상</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{normalCount}건</p>
                  </Card>
                </div>

                {/* 상태 필터 */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: '전체', color: '#6B7280' },
                    { key: 'shortage', label: `부족 (${shortageCount})`, color: '#EF4444' },
                    { key: 'overstock', label: `과잉 (${overstockCount})`, color: '#F59E0B' },
                    { key: 'normal', label: `정상 (${normalCount})`, color: '#10B981' },
                  ].map(f => (
                    <Button
                      key={f.key}
                      variant="ghost"
                      size="sm"
                      onClick={() => setInvFilter(f.key)}
                      className={`text-xs font-medium flex items-center gap-1.5 ${
                        invFilter === f.key
                          ? 'text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      style={invFilter === f.key ? { backgroundColor: f.color } : undefined}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                      {f.label}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 재고 과부족 차트 */}
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">재고 과부족 현황</h3>
                    {riskItems.length > 0 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={riskItems} layout="vertical" margin={{ left: 10, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="안전재고" fill="#9CA3AF" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="현재재고" radius={[0, 4, 4, 0]}>
                              {riskItems.map((entry, i) => (
                                <Cell key={i} fill={entry.status === 'Shortage' ? '#EF4444' : entry.status === 'Overstock' ? '#F59E0B' : '#10B981'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-gray-400 text-center py-10">{invFilter !== 'all' ? '해당 상태 품목 없음' : '리스크 재고 없음 (모두 정상)'}</p>}
                  </Card>

                  {/* 회전율 분포 + 상태 분포 */}
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">회전율 분포 & 상태 비율</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={turnoverDist}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: number) => `${v}건`} />
                            <Bar dataKey="count" name="품목수" radius={[4, 4, 0, 0]}>
                              {turnoverDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={statusPie} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                              {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => `${v}건`} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* 필터된 품목 테이블 */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <DynamicIcon name="inventory_2" size={20} className="text-red-500" />
                    재고 상세 <span className="text-sm text-gray-400 font-normal">({filteredInventory.length}건)</span>
                  </h3>
                  {filteredInventory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">품목</TableHead>
                            <TableHead className="text-center">상태</TableHead>
                            <TableHead className="text-right">현재재고</TableHead>
                            <TableHead className="text-right">안전재고</TableHead>
                            <TableHead className="text-right">괴리율</TableHead>
                            <TableHead className="text-right">회전율</TableHead>
                            <TableHead className="text-left">창고</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInventory.slice((invPage - 1) * INV_PAGE_SIZE, invPage * INV_PAGE_SIZE).map((item, i) => (
                            <TableRow key={item.id || i} className="cursor-pointer" onClick={() => onItemClick({ ...item, kind: 'inventory' })}>
                              <TableCell className="text-gray-800 dark:text-gray-200">{item.skuName}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`border-0 ${
                                  item.status === 'Shortage' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : item.status === 'Overstock' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                }`}>
                                  {item.status === 'Shortage' ? '부족' : item.status === 'Overstock' ? '과잉' : '정상'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold text-gray-900 dark:text-white">{item.currentStock}</TableCell>
                              <TableCell className="text-right text-gray-500">{item.safetyStock}</TableCell>
                              <TableCell className={`text-right font-medium ${
                                item.currentStock < item.safetyStock ? 'text-red-600' : item.currentStock > item.safetyStock * 3 ? 'text-orange-600' : 'text-gray-500'
                              }`}>
                                {item.safetyStock > 0 ? Math.round(((item.currentStock - item.safetyStock) / item.safetyStock) * 100) : 0}%
                              </TableCell>
                              <TableCell className={`text-right ${item.turnoverRate < config.lowTurnoverThreshold ? 'text-orange-600' : 'text-gray-600'}`}>
                                {item.turnoverRate.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-gray-500 text-xs">{item.warehouse || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {filteredInventory.length > INV_PAGE_SIZE && (
                        <Pagination
                          currentPage={invPage}
                          totalPages={Math.ceil(filteredInventory.length / INV_PAGE_SIZE)}
                          totalItems={filteredInventory.length}
                          startIndex={(invPage - 1) * INV_PAGE_SIZE}
                          endIndex={Math.min(invPage * INV_PAGE_SIZE, filteredInventory.length)}
                          onPrev={() => setInvPage(p => Math.max(1, p - 1))}
                          onNext={() => setInvPage(p => Math.min(Math.ceil(filteredInventory.length / INV_PAGE_SIZE), p + 1))}
                          onGoToPage={setInvPage}
                        />
                      )}
                    </div>
                  ) : <p className="text-gray-400 text-center py-6">해당 상태의 품목이 없습니다</p>}
                </Card>

                {/* ABC-XYZ 분류 매트릭스 */}
                {abcxyz && abcxyz.items.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <DynamicIcon name="grid_view" size={20} className="text-indigo-500" />
                      ABC-XYZ 재고 분류
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      ABC: 구매금액 비중 (A={config.abcClassAThreshold}%↑ / B={config.abcClassBThreshold}%↑ / C=나머지)
                      &nbsp;|&nbsp; XYZ: 변동계수 (X≤{config.xyzClassXThreshold} / Y≤{config.xyzClassYThreshold} / Z=나머지)
                    </p>

                    {/* 9칸 히트맵 */}
                    <div className="grid grid-cols-4 gap-1 mb-6 max-w-md">
                      <div className="text-xs text-center text-gray-400 py-2"></div>
                      <div className="text-xs text-center font-bold text-gray-600 dark:text-gray-300 py-2">X (안정)</div>
                      <div className="text-xs text-center font-bold text-gray-600 dark:text-gray-300 py-2">Y (변동)</div>
                      <div className="text-xs text-center font-bold text-gray-600 dark:text-gray-300 py-2">Z (불규칙)</div>
                      {(['A', 'B', 'C'] as const).map(abc => (
                        <React.Fragment key={abc}>
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 py-3 flex items-center justify-center">
                            {abc} ({abc === 'A' ? '고가' : abc === 'B' ? '중간' : '저가'})
                          </div>
                          {(['X', 'Y', 'Z'] as const).map(xyz => {
                            const count = abcxyz.matrix[`${abc}${xyz}`] || 0;
                            const intensity = count > 0 ? Math.min(count / Math.max(...Object.values(abcxyz.matrix)), 1) : 0;
                            const bgColor = abc === 'A'
                              ? `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`   // 빨강 계열
                              : abc === 'B'
                                ? `rgba(245, 158, 11, ${0.1 + intensity * 0.5})`  // 주황 계열
                                : `rgba(59, 130, 246, ${0.1 + intensity * 0.4})`; // 파랑 계열
                            return (
                              <div
                                key={`${abc}${xyz}`}
                                className="rounded-md py-3 text-center font-bold text-sm border border-gray-200 dark:border-gray-600"
                                style={{ backgroundColor: bgColor }}
                              >
                                <span className="text-gray-900 dark:text-white">{count}</span>
                                <span className="text-xs text-gray-500 ml-1">품목</span>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* 상위 분류 품목 테이블 */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">품목</TableHead>
                            <TableHead className="text-center">분류</TableHead>
                            <TableHead className="text-right">구매금액</TableHead>
                            <TableHead className="text-right">비중</TableHead>
                            <TableHead className="text-right">변동계수</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {abcxyz.items.slice(0, 20).map((item, i) => (
                            <TableRow key={item.productCode}>
                              <TableCell className="text-gray-800 dark:text-gray-200">{item.productName}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`border-0 ${
                                  item.abcClass === 'A' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : item.abcClass === 'B' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>{item.combined}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(item.totalSpent)}</TableCell>
                              <TableCell className="text-right text-gray-500">{item.spentShare}%</TableCell>
                              <TableCell className="text-right text-gray-500">{item.cv.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}

                {/* 신선도 점수 */}
                {freshness && freshness.items.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <DynamicIcon name="eco" size={20} className="text-green-500" />
                      신선도 점수
                      <FormulaTooltip {...FORMULAS.freshness} />
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      최근성(40%) + 재고회전(30%) + 수요안정성(30%) 기반 0~100점 평가
                    </p>

                    {/* 등급 요약 */}
                    <div className="grid grid-cols-5 gap-2 mb-6">
                      {([
                        { grade: 'safe' as FreshnessGrade, label: '안전', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', border: 'border-green-300' },
                        { grade: 'good' as FreshnessGrade, label: '양호', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', border: 'border-blue-300' },
                        { grade: 'caution' as FreshnessGrade, label: '주의', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', border: 'border-yellow-300' },
                        { grade: 'warning' as FreshnessGrade, label: '경고', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', border: 'border-orange-300' },
                        { grade: 'danger' as FreshnessGrade, label: '위험', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', border: 'border-red-300' },
                      ]).map(g => (
                        <div key={g.grade} className={`rounded-lg p-3 text-center border ${g.border} ${g.color}`}>
                          <p className="text-xs font-medium">{g.label}</p>
                          <p className="text-xl font-bold mt-1">{freshness.gradeCount[g.grade]}</p>
                        </div>
                      ))}
                    </div>
                    <div className="text-center mb-4">
                      <span className="text-sm text-gray-500">평균 신선도 점수: </span>
                      <span className={`text-lg font-bold ${
                        freshness.avgScore >= 60 ? 'text-green-600' : freshness.avgScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{freshness.avgScore}점</span>
                    </div>

                    {/* 위험 품목 테이블 (점수 낮은 순) */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">품목</TableHead>
                            <TableHead className="text-center">등급</TableHead>
                            <TableHead className="text-right">점수</TableHead>
                            <TableHead className="text-right">마지막 입고</TableHead>
                            <TableHead className="text-right">현재재고</TableHead>
                            <TableHead className="text-right">잔여일수</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {freshness.items.slice(0, 20).map(item => {
                            const gradeStyle: Record<FreshnessGrade, string> = {
                              safe: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              caution: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                              warning: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                              danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                            };
                            const gradeLabel: Record<FreshnessGrade, string> = {
                              safe: '안전', good: '양호', caution: '주의', warning: '경고', danger: '위험',
                            };
                            return (
                              <TableRow key={item.productCode}>
                                <TableCell className="text-gray-800 dark:text-gray-200">{item.productName}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`border-0 ${gradeStyle[item.grade]}`}>
                                    {gradeLabel[item.grade]}
                                  </Badge>
                                </TableCell>
                                <TableCell className={`text-right font-bold ${
                                  item.score >= 60 ? 'text-green-600' : item.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                                }`}>{item.score}</TableCell>
                                <TableCell className="text-right text-gray-500">{item.daysSinceLastPurchase}일 전</TableCell>
                                <TableCell className="text-right text-gray-600 dark:text-gray-400">{formatQty(item.currentStock)}</TableCell>
                                <TableCell className={`text-right font-medium ${
                                  item.estimatedDaysLeft <= 7 ? 'text-red-600' : item.estimatedDaysLeft <= 14 ? 'text-orange-600' : 'text-gray-600'
                                }`}>{item.estimatedDaysLeft >= 999 ? '-' : `${item.estimatedDaysLeft}일`}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>
              </InsightSection>
            );
          }

          // ========== 이상징후 분석 ==========
          if (activeTab === 'anomaly') {
            const sortedAnomalies = [...autoAnomalies].sort((a, b) =>
              anomalySort === 'score' ? b.anomalyScore - a.anomalyScore
              : Math.abs(b.countedQty - b.systemQty) - Math.abs(a.countedQty - a.systemQty)
            );
            const highScoreCount = sortedAnomalies.filter(a => a.anomalyScore >= config.anomalyScoreHigh).length;
            const avgScore = sortedAnomalies.length > 0
              ? Math.round(sortedAnomalies.reduce((s, a) => s + a.anomalyScore, 0) / sortedAnomalies.length)
              : 0;

            return (
              <InsightSection id={["inv-anomaly-price", "inv-anomaly-az"]}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">이상징후 항목</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{sortedAnomalies.length}건</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">고위험 ({config.anomalyScoreHigh}점+)</p>
                    <p className={`text-2xl font-bold mt-1 ${highScoreCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{highScoreCount}건</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">평균 이상점수</p>
                    <p className={`text-2xl font-bold mt-1 ${avgScore >= config.anomalyScoreWarning ? 'text-orange-600' : 'text-green-600'}`}>{avgScore}점</p>
                  </Card>
                </div>

                {/* 정렬 옵션 + 이상점수 분포 */}
                {sortedAnomalies.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">이상점수 분포</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedAnomalies.slice(0, 15).map(a => ({
                          name: a.materialName.length > 8 ? a.materialName.slice(0, 8) + '...' : a.materialName,
                          이상점수: a.anomalyScore,
                          차이수량: Math.abs(a.countedQty - a.systemQty),
                        }))} margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="이상점수" radius={[4, 4, 0, 0]}>
                            {sortedAnomalies.slice(0, 15).map((a, i) => (
                              <Cell key={i} fill={
                                a.anomalyScore >= config.anomalyScoreCritical ? '#EF4444'
                                : a.anomalyScore >= config.anomalyScoreWarning ? '#F59E0B'
                                : '#3B82F6'
                              } />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <DynamicIcon name="search" size={20} className="text-orange-500" />
                      재고 실사 이상징후
                      <FormulaTooltip {...FORMULAS.inventoryAnomaly} />
                    </h3>
                    <div className="flex gap-2">
                      {([
                        { key: 'score' as const, label: '점수순' },
                        { key: 'diff' as const, label: '차이순' },
                      ]).map(s => (
                        <Button key={s.key} variant="ghost" size="sm" onClick={() => setAnomalySort(s.key)}
                          className={`text-xs font-medium ${
                            anomalySort === s.key ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>{s.label}</Button>
                      ))}
                    </div>
                  </div>
                  {sortedAnomalies.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">품목</TableHead>
                            <TableHead className="text-left">위치</TableHead>
                            <TableHead className="text-right">전산 재고</TableHead>
                            <TableHead className="text-right">실사 재고</TableHead>
                            <TableHead className="text-right">차이</TableHead>
                            <TableHead className="text-right">AI 예측</TableHead>
                            <TableHead className="text-center">이상점수</TableHead>
                            <TableHead className="text-left">사유</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedAnomalies.slice(0, 20).map((item, i) => {
                            const diff = item.countedQty - item.systemQty;
                            return (
                              <TableRow key={item.id || i} className="cursor-pointer" onClick={() => onItemClick({ ...item, kind: 'stocktake' })}>
                                <TableCell className="text-gray-800 dark:text-gray-200 font-medium">{item.materialName}</TableCell>
                                <TableCell className="text-gray-500 text-xs">{item.location}</TableCell>
                                <TableCell className="text-right text-gray-600 dark:text-gray-400">{item.systemQty}</TableCell>
                                <TableCell className="text-right text-gray-600 dark:text-gray-400">{item.countedQty}</TableCell>
                                <TableCell className={`text-right font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </TableCell>
                                <TableCell className="text-right text-purple-600">{item.aiExpectedQty}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`inline-block w-10 text-center border-0 ${
                                    item.anomalyScore >= config.anomalyScoreCritical ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : item.anomalyScore >= config.anomalyScoreWarning ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  }`}>
                                    {item.anomalyScore}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-gray-500 text-xs max-w-[150px] truncate">{item.reason}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <DynamicIcon name="check_circle" size={36} className="text-gray-300 mb-2 mx-auto" />
                      <p className="text-gray-400">이상징후 데이터가 없습니다.</p>
                      <p className="text-xs text-gray-400 mt-1">재고 실사 데이터가 수집되면 자동으로 분석됩니다.</p>
                    </div>
                  )}
                </Card>
              </div>
              </InsightSection>
            );
          }

          // ========== 통계적 발주 ==========
          if (activeTab === 'statistical') {
            const allItems = statisticalOrder?.items || [];
            // D2: 업체별 필터링
            const items = supplierFilter === 'all'
              ? allItems
              : allItems.filter(i => getSupplierForProduct(i.productCode, suppliers).id === supplierFilter);
            const shortageCount = items.filter(i => i.status === 'shortage').length;
            const urgentCount = items.filter(i => i.status === 'urgent').length;
            const orderNeeded = items.filter(i => i.suggestedOrderQty > 0).length;
            // 업체별 발주 합계
            const supplierOrderSummary = suppliers.map(s => {
              const sItems = allItems.filter(i => getSupplierForProduct(i.productCode, suppliers).id === s.id);
              const orderQty = sItems.reduce((sum, i) => sum + i.suggestedOrderQty, 0);
              return { ...s, itemCount: sItems.length, orderQty };
            });

            // 재고일수 Horizontal Bar 차트 데이터 (상위 15개)
            const daysBarData = items
              .filter(i => i.daysOfStock < 999)
              .slice(0, 15)
              .map(i => ({
                name: i.productName.length > 12 ? i.productName.slice(0, 12) + '...' : i.productName,
                재고일수: i.daysOfStock,
                status: i.status,
              }));

            return (
              <InsightSection id="inv-stat-order">
              <div className="space-y-6">
                {/* 서비스 수준 + 발주일 선택 + KPI */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">서비스 수준</p>
                    <div className="flex gap-1">
                      {[90, 95, 97, 99].map(level => (
                        <Button
                          key={level}
                          variant="ghost"
                          size="sm"
                          onClick={() => setServiceLevel(level)}
                          className={`px-2 py-1 text-xs font-medium ${
                            serviceLevel === level
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {level}%
                        </Button>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">발주일 선택</p>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={e => setOrderDate(e.target.value)}
                      className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">발주 필요</p>
                    <p className={`text-2xl font-bold mt-1 ${orderNeeded > 0 ? 'text-blue-600' : 'text-green-600'}`}>{orderNeeded}건</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">긴급</p>
                    <p className={`text-2xl font-bold mt-1 ${urgentCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{urgentCount}건</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">부족</p>
                    <p className={`text-2xl font-bold mt-1 ${shortageCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{shortageCount}건</p>
                  </Card>
                </div>

                {/* D2: 업체별 탭 */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSupplierFilter('all')}
                    className={`text-xs font-medium ${
                      supplierFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    전체 ({allItems.length})
                  </Button>
                  {supplierOrderSummary.map(s => (
                    <Button
                      key={s.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSupplierFilter(s.id)}
                      className={`text-xs font-medium ${
                        supplierFilter === s.id
                          ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {s.name} ({s.itemCount})
                      {s.orderQty > 0 && <span className="ml-1 text-red-300">!</span>}
                    </Button>
                  ))}
                </div>

                {/* 선택 업체 발주 KPI */}
                {supplierFilter !== 'all' && (() => {
                  const sel = supplierOrderSummary.find(s => s.id === supplierFilter);
                  return sel ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 flex items-center gap-6">
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">발주처</p>
                        <p className="font-bold text-gray-900 dark:text-white">{sel.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">발주 방법</p>
                        <p className="font-medium text-gray-700 dark:text-gray-300">{sel.methodLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">리드타임</p>
                        <p className="font-medium text-gray-700 dark:text-gray-300">{sel.leadTime}일</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">발주 필요 수량</p>
                        <p className={`font-bold ${sel.orderQty > 0 ? 'text-red-600' : 'text-green-600'}`}>{sel.orderQty.toLocaleString()}</p>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* 재고일수 Bar 차트 */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">품목별 재고일수{supplierFilter !== 'all' ? ` (${supplierOrderSummary.find(s => s.id === supplierFilter)?.name})` : ''}</h3>
                  {daysBarData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={daysBarData} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} label={{ value: '일', position: 'insideRight', offset: -5, fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `${v}일`} />
                          <Bar dataKey="재고일수" radius={[0, 4, 4, 0]}>
                            {daysBarData.map((entry, i) => (
                              <Cell key={i} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || '#9CA3AF'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">통계적 발주 데이터 없음</p>}
                  <div className="flex gap-4 justify-center mt-2 text-xs">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }} />
                        <span className="text-gray-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* 통계적 발주 테이블 (발주처, 입고예정일, 발주하기 추가) */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <DynamicIcon name="calculate" size={20} className="text-blue-500" />
                    ROP / 안전재고 / EOQ 분석
                    <FormulaTooltip {...FORMULAS.statisticalOrder} />
                  </h3>
                  {items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">품목</TableHead>
                            <TableHead className="text-center">상태</TableHead>
                            <TableHead className="text-left">발주처</TableHead>
                            <TableHead className="text-center">발주방법</TableHead>
                            <TableHead className="text-right">현재재고</TableHead>
                            <TableHead className="text-right">ROP</TableHead>
                            <TableHead className="text-right">안전재고</TableHead>
                            <TableHead className="text-right">재고일수</TableHead>
                            <TableHead className="text-right">권장발주량</TableHead>
                            <TableHead className="text-center">입고예정</TableHead>
                            <TableHead className="text-center">발주</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.slice((statPage - 1) * STAT_PAGE_SIZE, statPage * STAT_PAGE_SIZE).map((item, i) => {
                            const supplier = getSupplierForProduct(item.productCode, suppliers);
                            const startDate = new Date(orderDate);
                            const deliveryDate = addBusinessDays(startDate, supplier.leadTime);
                            const deliveryStr = formatDateStr(deliveryDate);

                            const methodColors: Record<string, string> = {
                              email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              kakao: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                              ecount: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              phone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                              fax: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
                            };

                            return (
                              <TableRow key={item.productCode || i}>
                                <TableCell className="text-gray-800 dark:text-gray-200 text-xs">{item.productName}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className="border-0" style={{
                                    backgroundColor: `${STATUS_COLORS[item.status]}20`,
                                    color: STATUS_COLORS[item.status],
                                  }}>
                                    {STATUS_LABELS[item.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-gray-600 dark:text-gray-400">{supplier.name}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`border-0 ${methodColors[supplier.method]}`}>
                                    {supplier.methodLabel}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-bold text-gray-900 dark:text-white">{item.currentStock}</TableCell>
                                <TableCell className="text-right text-blue-600 font-medium">{item.rop}</TableCell>
                                <TableCell className="text-right text-purple-600">{item.safetyStock}</TableCell>
                                <TableCell className={`text-right font-medium ${
                                  item.daysOfStock < config.stockDaysUrgent ? 'text-red-600' : item.daysOfStock < config.stockDaysWarning ? 'text-orange-600' : 'text-gray-600'
                                }`}>
                                  {item.daysOfStock >= 999 ? '-' : `${item.daysOfStock}일`}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.suggestedOrderQty > 0 ? (
                                    <span className="font-bold text-red-600">{item.suggestedOrderQty.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-xs text-gray-500">
                                  {item.suggestedOrderQty > 0 ? deliveryStr.slice(5) : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.suggestedOrderQty > 0 ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOrder(item.productName, item.productCode, item.suggestedOrderQty)}
                                      className="text-xs gap-1 mx-auto"
                                    >
                                      <DynamicIcon name={supplier.icon} size={12} />
                                      발주
                                    </Button>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {items.length > STAT_PAGE_SIZE && (
                        <Pagination
                          currentPage={statPage}
                          totalPages={Math.ceil(items.length / STAT_PAGE_SIZE)}
                          totalItems={items.length}
                          startIndex={(statPage - 1) * STAT_PAGE_SIZE}
                          endIndex={Math.min(statPage * STAT_PAGE_SIZE, items.length)}
                          onPrev={() => setStatPage(p => Math.max(1, p - 1))}
                          onNext={() => setStatPage(p => Math.min(Math.ceil(items.length / STAT_PAGE_SIZE), p + 1))}
                          onGoToPage={setStatPage}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <DynamicIcon name="analytics" size={36} className="text-gray-300 mb-2 mx-auto" />
                      <p className="text-gray-400">통계적 발주 데이터가 없습니다.</p>
                      <p className="text-xs text-gray-400 mt-1">재고 및 구매 데이터가 수집되면 자동으로 계산됩니다.</p>
                    </div>
                  )}
                </Card>

                {/* 수식 참고 */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">계산 공식</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Safety Stock</span> = Z({serviceLevel}%) x &sigma; x &radic;L
                    </div>
                    <div>
                      <span className="font-medium">ROP</span> = (일평균수요 x 리드타임) + Safety Stock
                    </div>
                    <div>
                      <span className="font-medium">EOQ</span> = &radic;(2DS / H)
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">* 리드타임: {config.defaultLeadTime}일(±{config.leadTimeStdDev}), 주문비용: {config.orderCost.toLocaleString()}원, 유지비율: 단가의 {Math.round(config.holdingCostRate * 100)}%/년</p>
                </div>
              </div>
              </InsightSection>
            );
          }

          // ========== 재고비용 최적화 ==========
          if (activeTab === 'inventoryCost') {
            const ic = insights?.inventoryCost;
            const COST_COLORS = ['#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

            // 재고 스냅샷 추이 데이터 (US-006)
            const snapshotTrend = (() => {
              if (inventorySnapshots.length === 0) return null;
              // 날짜별 총 재고 수량 집계
              const byDate = new Map<string, number>();
              for (const s of inventorySnapshots) {
                byDate.set(s.snapshotDate, (byDate.get(s.snapshotDate) || 0) + s.balanceQty);
              }
              return [...byDate.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, qty]) => ({ date: date.slice(5), totalQty: qty }));
            })();
            const ABC_COLORS: Record<string, string> = { A: '#EF4444', B: '#F59E0B', C: '#3B82F6', 'N/A': '#9CA3AF' };

            // EOQ 비교 차트 데이터 (상위 10개)
            const eoqCompare = (ic?.items || [])
              .filter(item => item.eoq > 0 && item.annualDemand > 0)
              .slice(0, 10)
              .map(item => ({
                name: item.productName.length > 10 ? item.productName.slice(0, 10) + '...' : item.productName,
                현재발주량: item.annualDemand > 0 && item.orderFrequency > 0
                  ? Math.round(item.annualDemand / item.orderFrequency)
                  : 0,
                EOQ: item.eoq,
              }));

            return (
              <InsightSection id={["inv-abc", "inv-cost"]}>
              <div className="space-y-6">
                {/* KPI 카드 4개 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">총 보유비용</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(ic?.summary.totalHoldingCost || 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">연간 추정</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">총 발주비용</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(ic?.summary.totalOrderingCost || 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">연간 추정</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">총 품절비용</p>
                    <p className={`text-2xl font-bold mt-1 ${(ic?.summary.totalStockoutCost || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(ic?.summary.totalStockoutCost || 0)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">기회비용 추정</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">총 재고비용</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(ic?.summary.grandTotal || 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">보유+발주+품절+폐기</p>
                  </Card>
                </div>

                {/* 비용 구조 + EOQ 비교 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 비용 구조 파이차트 */}
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <DynamicIcon name="donut_large" size={20} className="text-purple-500" />
                      재고비용 구조
                    </h3>
                    {(ic?.costComposition?.length || 0) > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={ic!.costComposition}
                              cx="50%" cy="50%"
                              innerRadius={50} outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                              nameKey="name"
                              label={({ name, value }) => `${name} ${formatCurrency(value)}`}
                            >
                              {ic!.costComposition.map((_, i) => (
                                <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
                  </Card>

                  {/* EOQ vs 현재 발주량 비교 */}
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <DynamicIcon name="compare_arrows" size={20} className="text-blue-500" />
                      EOQ vs 현재 발주량
                    </h3>
                    {eoqCompare.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={eoqCompare} layout="vertical" margin={{ left: 10, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="현재발주량" fill="#9CA3AF" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="EOQ" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
                  </Card>
                </div>

                {/* 재고 스냅샷 추이 (US-006) */}
                {snapshotTrend && snapshotTrend.length > 1 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <DynamicIcon name="inventory_2" size={20} className="text-teal-500" />
                      재고 수량 추이
                      <span className="text-xs font-normal text-gray-400 ml-2">스냅샷 기준</span>
                    </h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={snapshotTrend} margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatQty(v)} />
                          <Tooltip formatter={(v: number) => formatQty(v)} />
                          <Line type="monotone" dataKey="totalQty" stroke="#14B8A6" strokeWidth={2} dot={{ r: 2 }} name="총 재고수량" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {/* D4: ABC 분류별 접기/펼치기 + 추천 액션 3개씩 */}
                {(ic?.abcStrategies?.length || 0) > 0 && (() => {
                  const ABC_ACTIONS: Record<string, { icon: string; title: string; desc: string }[]> = {
                    A: [
                      { icon: 'monitor_heart', title: '실시간 재고 모니터링', desc: '일 1회 이상 재고 수준 확인, 안전재고 근접 시 즉시 알림' },
                      { icon: 'speed', title: 'JIT 발주 전환', desc: '적시 발주로 재고 보유비용 최소화, 리드타임 단축 협상' },
                      { icon: 'tune', title: '안전재고 최적화', desc: '수요 변동 패턴 분석으로 안전재고 수준 주기적 재조정' },
                    ],
                    B: [
                      { icon: 'calculate', title: 'EOQ 기반 정기 발주', desc: '경제적 주문량 계산으로 보유비용+발주비용 균형 최적화' },
                      { icon: 'event_repeat', title: '발주 주기 표준화', desc: '주 1회 또는 격주 정기 발주로 관리 효율 향상' },
                      { icon: 'diversity_3', title: '공급처 다변화', desc: '2~3개 대체 공급처 확보로 공급 리스크 분산' },
                    ],
                    C: [
                      { icon: 'shopping_bag', title: '대량 구매 할인 협상', desc: '분기/반기 단위 대량 발주로 단가 절감 협상' },
                      { icon: 'merge', title: '발주 통합', desc: '유사 품목 묶음 발주로 발주 횟수 및 물류비 절감' },
                      { icon: 'smart_toy', title: '최소 관리 자동화', desc: '자동 발주 시스템 설정, 수동 관리 최소화' },
                    ],
                  };

                  const abcGroups = ic!.abcStrategies.filter(s => s.abcClass !== 'N/A');
                  const groupItems = (abcClass: string) =>
                    (ic?.items || []).filter(item => item.abcClass === abcClass);

                  return (
                    <Card className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <DynamicIcon name="category" size={20} className="text-orange-500" />
                        ABC 분류별 전략 & 품목
                      </h3>
                      <div className="space-y-3">
                        {abcGroups.map(s => {
                          const isExpanded = expandedAbc === s.abcClass;
                          const gItems = groupItems(s.abcClass);
                          const actions = ABC_ACTIONS[s.abcClass] || [];
                          return (
                            <div key={s.abcClass} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                              {/* 헤더 (클릭 시 접기/펼치기) */}
                              <Button
                                variant="ghost"
                                onClick={() => setExpandedAbc(isExpanded ? null : s.abcClass)}
                                className="w-full flex items-center justify-between p-4 h-auto rounded-none"
                              >
                                <div className="flex items-center gap-3">
                                  <Badge className="border-0 text-sm font-bold text-white" style={{ backgroundColor: ABC_COLORS[s.abcClass] || '#9CA3AF' }}>
                                    {s.abcClass}등급
                                  </Badge>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">{s.itemCount}개 품목</span>
                                  <span className="text-sm text-gray-500">|</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">총 비용: {formatCurrency(s.totalCost)}</span>
                                </div>
                                <DynamicIcon name="expand_more" size={20} className="text-gray-400 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                              </Button>

                              {/* 펼쳐진 내용 */}
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800">
                                  {/* 추천 액션 3개 */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                                    {actions.map((action, idx) => (
                                      <div key={idx} className="rounded-lg p-3 border border-gray-200 dark:border-gray-700" style={{ backgroundColor: `${ABC_COLORS[s.abcClass]}08` }}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <DynamicIcon name={action.icon} size={14} style={{ color: ABC_COLORS[s.abcClass] }} />
                                          <span className="text-sm font-medium text-gray-900 dark:text-white">{action.title}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{action.desc}</p>
                                      </div>
                                    ))}
                                  </div>

                                  {/* 그룹 품목 테이블 */}
                                  {gItems.length > 0 && (
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-left">품목</TableHead>
                                            <TableHead className="text-right text-blue-600">보유비용</TableHead>
                                            <TableHead className="text-right text-yellow-600">발주비용</TableHead>
                                            <TableHead className="text-right text-red-600">품절비용</TableHead>
                                            <TableHead className="text-right">총비용</TableHead>
                                            <TableHead className="text-right text-green-600">EOQ절감</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {gItems.slice(0, 15).map(item => (
                                            <TableRow key={item.productCode}>
                                              <TableCell className="text-gray-800 dark:text-gray-200 text-xs">{item.productName}</TableCell>
                                              <TableCell className="text-right text-blue-600 text-xs">{formatCurrency(item.holdingCost)}</TableCell>
                                              <TableCell className="text-right text-yellow-600 text-xs">{formatCurrency(item.orderingCost)}</TableCell>
                                              <TableCell className="text-right text-red-500 text-xs">{formatCurrency(item.estimatedStockoutCost)}</TableCell>
                                              <TableCell className="text-right font-medium text-gray-900 dark:text-white text-xs">{formatCurrency(item.totalCost)}</TableCell>
                                              <TableCell className={`text-right text-xs font-medium ${item.eoqSaving > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                {item.eoqSaving > 0 ? formatCurrency(item.eoqSaving) : '-'}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                          {/* 그룹 합계 */}
                                          <TableRow className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                                            <TableCell className="text-gray-900 dark:text-white text-xs">합계 ({gItems.length}개)</TableCell>
                                            <TableCell className="text-right text-blue-600 text-xs">{formatCurrency(gItems.reduce((s, it) => s + it.holdingCost, 0))}</TableCell>
                                            <TableCell className="text-right text-yellow-600 text-xs">{formatCurrency(gItems.reduce((s, it) => s + it.orderingCost, 0))}</TableCell>
                                            <TableCell className="text-right text-red-500 text-xs">{formatCurrency(gItems.reduce((s, it) => s + it.estimatedStockoutCost, 0))}</TableCell>
                                            <TableCell className="text-right text-gray-900 dark:text-white text-xs">{formatCurrency(gItems.reduce((s, it) => s + it.totalCost, 0))}</TableCell>
                                            <TableCell className="text-right text-green-600 text-xs">{formatCurrency(gItems.reduce((s, it) => s + it.eoqSaving, 0))}</TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })()}

                {/* 수식 참고 */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">비용 계산 공식</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500">
                    <div><span className="font-medium">보유비용</span> = 평균재고 × 단가 × {Math.round(config.holdingCostRate * 100)}%/년</div>
                    <div><span className="font-medium">발주비용</span> = 연간발주횟수 × {config.orderCost.toLocaleString()}원/건</div>
                    <div><span className="font-medium">품절비용</span> = 위험도 × 일수요 × 단가 × 리드타임 × {config.stockoutCostMultiplier}</div>
                    <div><span className="font-medium">EOQ</span> = &radic;(2 × 연수요 × 주문비 / 단위유지비)</div>
                  </div>
                </div>
              </div>
              </InsightSection>
            );
          }

          // ========== 발주 분석 ==========
          if (activeTab !== 'purchase') return null;

          const totalPurchaseAmount = purchases.reduce((s, p) => s + p.total, 0);
          const productAmountMap = new Map<string, number>();
          purchases.forEach(p => {
            productAmountMap.set(p.productName, (productAmountMap.get(p.productName) || 0) + p.total);
          });
          const top10Products = Array.from(productAmountMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, amount]) => ({
              name: name.length > 10 ? name.slice(0, 10) + '...' : name,
              금액: amount,
            }));

          // D3: 상위 5개 품목 주간 구매추이
          const top5Names = Array.from(productAmountMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);

          const TOP5_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

          const weeklyPurchaseMap = groupByWeek(purchases, 'date');
          const weeklyTop5Data = getSortedWeekEntries(weeklyPurchaseMap).map(([wk, items]) => {
            const entry: Record<string, any> = { week: weekKeyToLabel(wk) };
            top5Names.forEach(name => {
              entry[name] = items.filter(p => p.productName === name).reduce((s, p) => s + p.total, 0);
            });
            return entry;
          });

          // 공급처별(품목별) 구매 비중 PieChart
          const supplierPieData = Array.from(productAmountMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, amount]) => ({
              name: name.length > 12 ? name.slice(0, 12) + '...' : name,
              value: amount,
            }));
          const PIE_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

          const uniqueProducts = new Set(purchases.map(p => p.productCode)).size;

          const lowTurnover = inventoryData
            .filter(i => i.turnoverRate < config.lowTurnoverThreshold && i.currentStock > 0)
            .sort((a, b) => a.turnoverRate - b.turnoverRate);

          return (
            <InsightSection id="inv-abc">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 구매액</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalPurchaseAmount)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">구매 품목 수</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{uniqueProducts}개</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">저회전 품목</p>
                  <p className={`text-2xl font-bold mt-1 ${lowTurnover.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>{lowTurnover.length}건</p>
                </Card>
              </div>

              {/* D3: 상위 5개 품목 주간 구매추이 */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <DynamicIcon name="trending_up" size={20} className="text-blue-500" />
                  주요 품목 주간 구매추이 (상위 5)
                </h3>
                {weeklyTop5Data.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyTop5Data} margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={45} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {top5Names.map((name, idx) => (
                          <Line
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={TOP5_COLORS[idx]}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            name={name.length > 12 ? name.slice(0, 12) + '...' : name}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">구매 데이터 없음</p>}
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 품목별 구매금액 Top10 */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">품목별 구매 금액 Top10</h3>
                  {top10Products.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top10Products} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="금액" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">구매 데이터 없음</p>}
                </Card>

                {/* D3: 공급처별 구매 비중 PieChart */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">품목별 구매 비중</h3>
                  {supplierPieData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={supplierPieData}
                            cx="50%" cy="50%"
                            innerRadius={45} outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {supplierPieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">구매 데이터 없음</p>}
                </Card>
              </div>

              {lowTurnover.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <DynamicIcon name="hourglass_empty" size={20} className="text-orange-500" />
                    저회전 품목 (회전율 &lt; {config.lowTurnoverThreshold})
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">품목</TableHead>
                          <TableHead className="text-right">현재재고</TableHead>
                          <TableHead className="text-right">회전율</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowTurnover.slice(0, 10).map((item, i) => (
                          <TableRow key={item.id || i} className="cursor-pointer" onClick={() => onItemClick({ ...item, kind: 'inventory' })}>
                            <TableCell className="text-gray-800 dark:text-gray-200">{item.skuName}</TableCell>
                            <TableCell className="text-right text-gray-600 dark:text-gray-400">{item.currentStock}</TableCell>
                            <TableCell className="text-right text-orange-600 font-medium">{item.turnoverRate.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              {/* 주간 구매 추이 테이블 */}
              {weeklyTop5Data.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 구매 추이 (상위 5 품목)</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">주차</TableHead>
                          {top5Names.map((name, idx) => (
                            <TableHead key={name} className="text-right" style={{ color: TOP5_COLORS[idx] }}>
                              {name.length > 8 ? name.slice(0, 8) + '...' : name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyTop5Data.slice(-8).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-gray-600 dark:text-gray-400 text-xs">{row.week}</TableCell>
                            {top5Names.map(name => (
                              <TableCell key={name} className="text-right font-medium text-gray-900 dark:text-white">
                                {(row[name] as number) > 0 ? formatCurrency(row[name] as number) : '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">최근 구매 내역</h3>
                {purchases.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">날짜</TableHead>
                          <TableHead className="text-left">품목</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead className="text-right">단가</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...purchases].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-gray-500 text-xs">{p.date}</TableCell>
                            <TableCell className="text-gray-800 dark:text-gray-200">{p.productName}</TableCell>
                            <TableCell className="text-right text-gray-600 dark:text-gray-400">{p.quantity.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-gray-600 dark:text-gray-400">{p.unitPrice.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-medium text-gray-900 dark:text-white">{formatCurrency(p.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">구매 데이터 없음</p>}
              </Card>
            </div>
            </InsightSection>
          );
        }}
      </SubTabLayout>

      {/* 발주 모달 */}
      {orderModal && (
        <OrderModal
          supplier={orderModal.supplier}
          productName={orderModal.productName}
          quantity={orderModal.quantity}
          orderDate={orderDate}
          deliveryDate={orderModal.deliveryDate}
          onClose={() => setOrderModal(null)}
          onConfirm={handleConfirmOrder}
        />
      )}
    </>
  );
};
