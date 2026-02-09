import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import { SubTabLayout } from './SubTabLayout';
import { formatCurrency, formatAxisKRW, formatQty } from '../utils/format';
import { InventorySafetyItem, StocktakeAnomalyItem } from '../types';
import type { PurchaseData } from '../services/googleSheetService';
import type { DashboardInsights, StatisticalOrderInsight, ABCXYZInsight, FreshnessInsight, FreshnessGrade } from '../services/insightService';
import { computeStatisticalOrder } from '../services/insightService';
import { useBusinessConfig } from '../contexts/SettingsContext';

interface Props {
  inventoryData: InventorySafetyItem[];
  purchases: PurchaseData[];
  insights: DashboardInsights | null;
  stocktakeAnomalies: StocktakeAnomalyItem[];
  onItemClick: (item: any) => void;
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

const SUPPLIERS: Supplier[] = [
  { id: 's1', name: '(주)대한식품', method: 'email', methodLabel: '이메일', leadTime: 3, contact: 'order@daehan.co.kr', icon: 'email' },
  { id: 's2', name: '삼성농산', method: 'kakao', methodLabel: '카카오톡', leadTime: 2, contact: '삼성농산 발주채널', icon: 'chat' },
  { id: 's3', name: '한국포장재', method: 'ecount', methodLabel: 'ECOUNT', leadTime: 5, contact: 'ECOUNT 자동발주', icon: 'computer' },
  { id: 's4', name: '신선유통', method: 'phone', methodLabel: '전화', leadTime: 1, contact: '02-1234-5678', icon: 'phone' },
  { id: 's5', name: '글로벌소스', method: 'email', methodLabel: '이메일', leadTime: 7, contact: 'sales@globalsauce.kr', icon: 'email' },
  { id: 's6', name: '농협유통', method: 'fax', methodLabel: '팩스', leadTime: 3, contact: '02-9876-5432', icon: 'print' },
];

// 품목 코드 기반 발주처 배정 (해시 기반 결정적 배정)
function getSupplierForProduct(productCode: string): Supplier {
  let hash = 0;
  for (let i = 0; i < productCode.length; i++) {
    hash = ((hash << 5) - hash) + productCode.charCodeAt(i);
    hash = hash & hash;
  }
  return SUPPLIERS[Math.abs(hash) % SUPPLIERS.length];
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
          <span className="material-icons-outlined text-blue-500">shopping_cart</span>
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
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${methodColors[supplier.method]}`}>
              <span className="material-icons-outlined text-xs mr-1 align-middle">{supplier.icon}</span>
              {supplier.methodLabel}
            </span>
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
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            취소
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1">
            <span className="material-icons-outlined text-base">{supplier.icon}</span>
            {supplier.methodLabel}로 발주
          </button>
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
  onItemClick,
}) => {
  const config = useBusinessConfig();
  const materialPrices = insights?.materialPrices;
  const [serviceLevel, setServiceLevel] = useState(95);
  const [orderDate, setOrderDate] = useState(formatDateStr(new Date()));
  const [orderModal, setOrderModal] = useState<{
    supplier: Supplier;
    productName: string;
    quantity: number;
    deliveryDate: string;
  } | null>(null);

  // 서비스 수준 변경 시 재계산
  const statisticalOrder: StatisticalOrderInsight | null = useMemo(() => {
    if (insights?.statisticalOrder && serviceLevel === config.defaultServiceLevel) {
      return insights.statisticalOrder;
    }
    if (inventoryData.length > 0 && purchases.length > 0) {
      return computeStatisticalOrder(inventoryData, purchases, config, serviceLevel);
    }
    return null;
  }, [inventoryData, purchases, serviceLevel, config, insights?.statisticalOrder]);

  const abcxyz = insights?.abcxyz || null;
  const freshness = insights?.freshness || null;

  const tabs = [
    { key: 'inventory', label: '재고 현황', icon: 'inventory_2' },
    { key: 'anomaly', label: '이상징후 분석', icon: 'warning' },
    { key: 'statistical', label: '통계적 발주', icon: 'calculate' },
    { key: 'purchase', label: '발주 분석', icon: 'shopping_cart' },
  ];

  const handleOrder = (productName: string, productCode: string, quantity: number) => {
    const supplier = getSupplierForProduct(productCode);
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
      <SubTabLayout title="재고/발주 관리" tabs={tabs}>
        {(activeTab) => {
          // ========== 재고 현황 ==========
          if (activeTab === 'inventory') {
            const shortageCount = inventoryData.filter(i => i.status === 'Shortage').length;
            const overstockCount = inventoryData.filter(i => i.status === 'Overstock').length;
            const normalCount = inventoryData.filter(i => i.status === 'Normal').length;

            const riskItems = inventoryData
              .filter(i => i.status !== 'Normal')
              .slice(0, 15)
              .map(i => ({
                name: i.skuName.length > 10 ? i.skuName.slice(0, 10) + '...' : i.skuName,
                현재재고: i.currentStock,
                안전재고: i.safetyStock,
                status: i.status,
              }));

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">부족</p>
                    <p className={`text-2xl font-bold mt-1 ${shortageCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{shortageCount}건</p>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">과잉</p>
                    <p className={`text-2xl font-bold mt-1 ${overstockCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{overstockCount}건</p>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">정상</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{normalCount}건</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
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
                              <Cell key={i} fill={entry.status === 'Shortage' ? '#EF4444' : '#F59E0B'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">리스크 재고 없음 (모두 정상)</p>}
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-red-500">warning</span>
                    리스크 품목
                  </h3>
                  {inventoryData.filter(i => i.status !== 'Normal').length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-500">품목</th>
                            <th className="text-center py-2 px-3 text-gray-500">상태</th>
                            <th className="text-right py-2 px-3 text-gray-500">현재재고</th>
                            <th className="text-right py-2 px-3 text-gray-500">안전재고</th>
                            <th className="text-right py-2 px-3 text-gray-500">괴리율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryData.filter(i => i.status !== 'Normal').slice(0, 20).map((item, i) => (
                            <tr key={item.id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick(item)}>
                              <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.skuName}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.status === 'Shortage' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                  {item.status === 'Shortage' ? '부족' : '과잉'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">{item.currentStock}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{item.safetyStock}</td>
                              <td className="py-2 px-3 text-right text-gray-500">
                                {item.safetyStock > 0 ? Math.round(((item.currentStock - item.safetyStock) / item.safetyStock) * 100) : 0}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-gray-400 text-center py-6">리스크 항목 없음</p>}
                </div>

                {/* ABC-XYZ 분류 매트릭스 */}
                {abcxyz && abcxyz.items.length > 0 && (
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-icons-outlined text-indigo-500">grid_view</span>
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
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-500">품목</th>
                            <th className="text-center py-2 px-3 text-gray-500">분류</th>
                            <th className="text-right py-2 px-3 text-gray-500">구매금액</th>
                            <th className="text-right py-2 px-3 text-gray-500">비중</th>
                            <th className="text-right py-2 px-3 text-gray-500">변동계수</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abcxyz.items.slice(0, 20).map((item, i) => (
                            <tr key={item.productCode} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  item.abcClass === 'A' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : item.abcClass === 'B' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>{item.combined}</span>
                              </td>
                              <td className="py-2 px-3 text-right font-medium">{formatCurrency(item.totalSpent)}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{item.spentShare}%</td>
                              <td className="py-2 px-3 text-right text-gray-500">{item.cv.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 신선도 점수 */}
                {freshness && freshness.items.length > 0 && (
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-icons-outlined text-green-500">eco</span>
                      신선도 점수
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
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-500">품목</th>
                            <th className="text-center py-2 px-3 text-gray-500">등급</th>
                            <th className="text-right py-2 px-3 text-gray-500">점수</th>
                            <th className="text-right py-2 px-3 text-gray-500">마지막 입고</th>
                            <th className="text-right py-2 px-3 text-gray-500">현재재고</th>
                            <th className="text-right py-2 px-3 text-gray-500">잔여일수</th>
                          </tr>
                        </thead>
                        <tbody>
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
                              <tr key={item.productCode} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${gradeStyle[item.grade]}`}>
                                    {gradeLabel[item.grade]}
                                  </span>
                                </td>
                                <td className={`py-2 px-3 text-right font-bold ${
                                  item.score >= 60 ? 'text-green-600' : item.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                                }`}>{item.score}</td>
                                <td className="py-2 px-3 text-right text-gray-500">{item.daysSinceLastPurchase}일 전</td>
                                <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatQty(item.currentStock)}</td>
                                <td className={`py-2 px-3 text-right font-medium ${
                                  item.estimatedDaysLeft <= 7 ? 'text-red-600' : item.estimatedDaysLeft <= 14 ? 'text-orange-600' : 'text-gray-600'
                                }`}>{item.estimatedDaysLeft >= 999 ? '-' : `${item.estimatedDaysLeft}일`}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // ========== 이상징후 분석 ==========
          if (activeTab === 'anomaly') {
            const sortedAnomalies = [...stocktakeAnomalies].sort((a, b) => b.anomalyScore - a.anomalyScore);
            const highScoreCount = sortedAnomalies.filter(a => a.anomalyScore >= config.anomalyScoreHigh).length;
            const avgScore = sortedAnomalies.length > 0
              ? Math.round(sortedAnomalies.reduce((s, a) => s + a.anomalyScore, 0) / sortedAnomalies.length)
              : 0;

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">이상징후 항목</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{sortedAnomalies.length}건</p>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">고위험 ({config.anomalyScoreHigh}점+)</p>
                    <p className={`text-2xl font-bold mt-1 ${highScoreCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{highScoreCount}건</p>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">평균 이상점수</p>
                    <p className={`text-2xl font-bold mt-1 ${avgScore >= config.anomalyScoreWarning ? 'text-orange-600' : 'text-green-600'}`}>{avgScore}점</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-orange-500">search</span>
                    재고 실사 이상징후
                  </h3>
                  {sortedAnomalies.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-500">품목</th>
                            <th className="text-left py-2 px-3 text-gray-500">위치</th>
                            <th className="text-right py-2 px-3 text-gray-500">전산 재고</th>
                            <th className="text-right py-2 px-3 text-gray-500">실사 재고</th>
                            <th className="text-right py-2 px-3 text-gray-500">차이</th>
                            <th className="text-right py-2 px-3 text-gray-500">AI 예측</th>
                            <th className="text-center py-2 px-3 text-gray-500">이상점수</th>
                            <th className="text-left py-2 px-3 text-gray-500">사유</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedAnomalies.slice(0, 20).map((item, i) => {
                            const diff = item.countedQty - item.systemQty;
                            return (
                              <tr key={item.id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick(item)}>
                                <td className="py-2 px-3 text-gray-800 dark:text-gray-200 font-medium">{item.materialName}</td>
                                <td className="py-2 px-3 text-gray-500 text-xs">{item.location}</td>
                                <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.systemQty}</td>
                                <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.countedQty}</td>
                                <td className={`py-2 px-3 text-right font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </td>
                                <td className="py-2 px-3 text-right text-purple-600">{item.aiExpectedQty}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`inline-block w-10 text-center px-1 py-0.5 rounded text-xs font-bold ${
                                    item.anomalyScore >= config.anomalyScoreCritical ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : item.anomalyScore >= config.anomalyScoreWarning ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  }`}>
                                    {item.anomalyScore}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-gray-500 text-xs max-w-[150px] truncate">{item.reason}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <span className="material-icons-outlined text-4xl text-gray-300 mb-2">check_circle</span>
                      <p className="text-gray-400">이상징후 데이터가 없습니다.</p>
                      <p className="text-xs text-gray-400 mt-1">재고 실사 데이터가 수집되면 자동으로 분석됩니다.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ========== 통계적 발주 ==========
          if (activeTab === 'statistical') {
            const items = statisticalOrder?.items || [];
            const shortageCount = items.filter(i => i.status === 'shortage').length;
            const urgentCount = items.filter(i => i.status === 'urgent').length;
            const orderNeeded = items.filter(i => i.suggestedOrderQty > 0).length;

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
              <div className="space-y-6">
                {/* 서비스 수준 + 발주일 선택 + KPI */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">서비스 수준</p>
                    <div className="flex gap-1">
                      {[90, 95, 97, 99].map(level => (
                        <button
                          key={level}
                          onClick={() => setServiceLevel(level)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            serviceLevel === level
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {level}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">발주일 선택</p>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={e => setOrderDate(e.target.value)}
                      className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">발주 필요</p>
                    <p className={`text-2xl font-bold mt-1 ${orderNeeded > 0 ? 'text-blue-600' : 'text-green-600'}`}>{orderNeeded}건</p>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">긴급</p>
                    <p className={`text-2xl font-bold mt-1 ${urgentCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{urgentCount}건</p>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">부족</p>
                    <p className={`text-2xl font-bold mt-1 ${shortageCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{shortageCount}건</p>
                  </div>
                </div>

                {/* 재고일수 Bar 차트 */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">품목별 재고일수</h3>
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
                </div>

                {/* 통계적 발주 테이블 (발주처, 입고예정일, 발주하기 추가) */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-blue-500">calculate</span>
                    ROP / 안전재고 / EOQ 분석
                  </h3>
                  {items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-2 text-gray-500">품목</th>
                            <th className="text-center py-2 px-2 text-gray-500">상태</th>
                            <th className="text-left py-2 px-2 text-gray-500">발주처</th>
                            <th className="text-center py-2 px-2 text-gray-500">발주방법</th>
                            <th className="text-right py-2 px-2 text-gray-500">현재재고</th>
                            <th className="text-right py-2 px-2 text-gray-500">ROP</th>
                            <th className="text-right py-2 px-2 text-gray-500">안전재고</th>
                            <th className="text-right py-2 px-2 text-gray-500">재고일수</th>
                            <th className="text-right py-2 px-2 text-gray-500">권장발주량</th>
                            <th className="text-center py-2 px-2 text-gray-500">입고예정</th>
                            <th className="text-center py-2 px-2 text-gray-500">발주</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.slice(0, 30).map((item, i) => {
                            const supplier = getSupplierForProduct(item.productCode);
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
                              <tr key={item.productCode || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="py-2 px-2 text-gray-800 dark:text-gray-200 text-xs">{item.productName}</td>
                                <td className="py-2 px-2 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                                    backgroundColor: `${STATUS_COLORS[item.status]}20`,
                                    color: STATUS_COLORS[item.status],
                                  }}>
                                    {STATUS_LABELS[item.status]}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-xs text-gray-600 dark:text-gray-400">{supplier.name}</td>
                                <td className="py-2 px-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${methodColors[supplier.method]}`}>
                                    {supplier.methodLabel}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right font-bold text-gray-900 dark:text-white">{item.currentStock}</td>
                                <td className="py-2 px-2 text-right text-blue-600 font-medium">{item.rop}</td>
                                <td className="py-2 px-2 text-right text-purple-600">{item.safetyStock}</td>
                                <td className={`py-2 px-2 text-right font-medium ${
                                  item.daysOfStock < config.stockDaysUrgent ? 'text-red-600' : item.daysOfStock < config.stockDaysWarning ? 'text-orange-600' : 'text-gray-600'
                                }`}>
                                  {item.daysOfStock >= 999 ? '-' : `${item.daysOfStock}일`}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  {item.suggestedOrderQty > 0 ? (
                                    <span className="font-bold text-red-600">{item.suggestedOrderQty.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center text-xs text-gray-500">
                                  {item.suggestedOrderQty > 0 ? deliveryStr.slice(5) : '-'}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {item.suggestedOrderQty > 0 ? (
                                    <button
                                      onClick={() => handleOrder(item.productName, item.productCode, item.suggestedOrderQty)}
                                      className="px-2 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 mx-auto"
                                    >
                                      <span className="material-icons-outlined text-xs">{supplier.icon}</span>
                                      발주
                                    </button>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <span className="material-icons-outlined text-4xl text-gray-300 mb-2">analytics</span>
                      <p className="text-gray-400">통계적 발주 데이터가 없습니다.</p>
                      <p className="text-xs text-gray-400 mt-1">재고 및 구매 데이터가 수집되면 자동으로 계산됩니다.</p>
                    </div>
                  )}
                </div>

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
            );
          }

          // ========== 발주 분석 ==========
          const totalPurchaseAmount = purchases.reduce((s, p) => s + p.total, 0);
          const supplierMap = new Map<string, number>();
          purchases.forEach(p => {
            supplierMap.set(p.productName, (supplierMap.get(p.productName) || 0) + p.total);
          });
          const supplierData = Array.from(supplierMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, amount]) => ({
              name: name.length > 10 ? name.slice(0, 10) + '...' : name,
              금액: amount,
            }));

          const monthlyMap = new Map<string, number>();
          purchases.forEach(p => {
            const month = p.date.slice(0, 7);
            monthlyMap.set(month, (monthlyMap.get(month) || 0) + p.total);
          });
          const monthlyData = Array.from(monthlyMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, total]) => ({ month, 구매액: total }));

          const uniqueProducts = new Set(purchases.map(p => p.productCode)).size;

          const lowTurnover = inventoryData
            .filter(i => i.turnoverRate < config.lowTurnoverThreshold && i.currentStock > 0)
            .sort((a, b) => a.turnoverRate - b.turnoverRate);

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 구매액</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalPurchaseAmount)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">구매 품목 수</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{uniqueProducts}개</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">저회전 품목</p>
                  <p className={`text-2xl font-bold mt-1 ${lowTurnover.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>{lowTurnover.length}건</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">품목별 구매 금액</h3>
                  {supplierData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={supplierData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="금액" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">구매 데이터 없음</p>}
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 구매 추이</h3>
                  {monthlyData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Line type="monotone" dataKey="구매액" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">구매 데이터 없음</p>}
                </div>
              </div>

              {lowTurnover.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-orange-500">hourglass_empty</span>
                    저회전 품목 (회전율 &lt; {config.lowTurnoverThreshold})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">품목</th>
                          <th className="text-right py-2 px-3 text-gray-500">현재재고</th>
                          <th className="text-right py-2 px-3 text-gray-500">회전율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowTurnover.slice(0, 10).map((item, i) => (
                          <tr key={item.id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick(item)}>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.skuName}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.currentStock}</td>
                            <td className="py-2 px-3 text-right text-orange-600 font-medium">{item.turnoverRate.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">최근 구매 내역</h3>
                {purchases.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">날짜</th>
                          <th className="text-left py-2 px-3 text-gray-500">품목</th>
                          <th className="text-right py-2 px-3 text-gray-500">수량</th>
                          <th className="text-right py-2 px-3 text-gray-500">단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...purchases].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((p, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-2 px-3 text-gray-500 text-xs">{p.date}</td>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{p.productName}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{p.quantity.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">₩{p.unitPrice.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">구매 데이터 없음</p>}
              </div>
            </div>
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
