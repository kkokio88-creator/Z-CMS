/**
 * 채널 비용 관리 어드민
 * 채널별 변동비/고정비 항목을 개별 행으로 관리
 * 명세서 §3.4 기반: 비용유형(매출대비%/건당원/월고정원) + 변동/고정 구분
 */

import React, { useState, useEffect } from 'react';

/** 비용 유형: rate=매출대비%, per_order=건당원, monthly_fixed=월고정원 */
export type CostType = 'rate' | 'per_order' | 'monthly_fixed';

export interface ChannelCostItem {
  id: string;
  channelName: string;
  costName: string;       // 비용 항목명 (예: 카드수수료, 배송비)
  costType: CostType;
  amount: number;         // rate이면 %, per_order/monthly_fixed이면 원
  isVariable: boolean;    // true=변동비(2단계), false=고정비(3단계)
}

/** 채널별 비용 요약 (insightService 연동용) */
export interface ChannelCostSummary {
  channelName: string;
  variableRateItems: { name: string; rate: number }[];     // 매출대비% 변동비
  variablePerOrderItems: { name: string; amount: number }[]; // 건당 변동비
  fixedMonthlyItems: { name: string; amount: number }[];    // 월 고정비
  totalVariableRatePct: number;   // 변동비 합계 %
  totalVariablePerOrder: number;  // 건당 변동비 합계 원
  totalFixedMonthly: number;      // 월 고정비 합계 원
  discountRate: number;           // 할인율 (%) — 권장판매가 대비
  commissionRate: number;         // 플랫폼 수수료율 (%) — 권장판매가 대비
  promotionDiscountRate: number;  // 할인매출비율 (%) — 공급가액 대비
}

/** 채널별 할인/수수료 설정 */
export interface ChannelPricingSetting {
  channelName: string;
  discountRate: number;     // 할인율 % (권장판매가 대비)
  commissionRate: number;   // 플랫폼 수수료율 % (권장판매가 대비)
  promotionDiscountRate: number; // 할인매출비율 % (공급가액 대비, 정산매출 = 공급가액 × (1 - rate/100))
}

const COST_TYPE_LABELS: Record<CostType, string> = {
  rate: '매출 대비 %',
  per_order: '건당 원',
  monthly_fixed: '월 고정 원',
};

const DEFAULT_ITEMS: ChannelCostItem[] = [
  // 자사몰
  { id: '1', channelName: '자사몰', costName: '카드결제 수수료', costType: 'rate', amount: 3.5, isVariable: true },
  { id: '2', channelName: '자사몰', costName: '택배 배송비', costType: 'per_order', amount: 3500, isVariable: true },
  { id: '3', channelName: '자사몰', costName: '포장 박스비', costType: 'per_order', amount: 1200, isVariable: true },
  // 쿠팡
  { id: '4', channelName: '쿠팡', costName: '판매 수수료', costType: 'rate', amount: 10.8, isVariable: true },
  { id: '5', channelName: '쿠팡', costName: '입고비', costType: 'per_order', amount: 500, isVariable: true },
  { id: '6', channelName: '쿠팡', costName: '광고비', costType: 'rate', amount: 5, isVariable: true },
  { id: '7', channelName: '쿠팡', costName: '전담 인력', costType: 'monthly_fixed', amount: 3500000, isVariable: false },
  // 컬리
  { id: '8', channelName: '컬리', costName: '판매 수수료', costType: 'rate', amount: 20, isVariable: true },
  { id: '9', channelName: '컬리', costName: '물류비', costType: 'per_order', amount: 2000, isVariable: true },
  { id: '10', channelName: '컬리', costName: '전용 포장재', costType: 'monthly_fixed', amount: 800000, isVariable: false },
];

const STORAGE_KEY = 'ZCMS_CHANNEL_COSTS_V2';
const PRICING_STORAGE_KEY = 'ZCMS_CHANNEL_PRICING';
let nextId = 100;

const DEFAULT_PRICING: ChannelPricingSetting[] = [
  { channelName: '자사몰', discountRate: 0, commissionRate: 0, promotionDiscountRate: 0 },
  { channelName: '쿠팡', discountRate: 5, commissionRate: 10.8, promotionDiscountRate: 4.27 },
  { channelName: '컬리', discountRate: 3, commissionRate: 20, promotionDiscountRate: 6.62 },
];

function loadChannelPricing(): ChannelPricingSetting[] {
  try {
    const saved = localStorage.getItem(PRICING_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_PRICING.map(p => ({ ...p }));
}

function saveChannelPricing(settings: ChannelPricingSetting[]) {
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(settings));
}

/** 외부에서 채널별 할인/수수료 설정을 조회 */
export function getChannelPricingSettings(): ChannelPricingSetting[] {
  return loadChannelPricing();
}

function generateId(): string {
  return String(++nextId);
}

function loadChannelCosts(): ChannelCostItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const items = JSON.parse(saved);
      // nextId를 기존 데이터 최대 id 이후로 설정
      items.forEach((item: ChannelCostItem) => {
        const num = parseInt(item.id, 10);
        if (!isNaN(num) && num >= nextId) nextId = num + 1;
      });
      return items;
    }
  } catch {}
  return DEFAULT_ITEMS.map(c => ({ ...c }));
}

function saveChannelCosts(items: ChannelCostItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** insightService 등 외부에서 호출 — 채널별 비용 요약 반환 */
export function getChannelCostSummaries(): ChannelCostSummary[] {
  const items = loadChannelCosts();
  const pricingSettings = loadChannelPricing();
  const channelMap = new Map<string, ChannelCostItem[]>();
  items.forEach(item => {
    const arr = channelMap.get(item.channelName) || [];
    arr.push(item);
    channelMap.set(item.channelName, arr);
  });

  const summaries: ChannelCostSummary[] = [];
  channelMap.forEach((channelItems, channelName) => {
    const variableRateItems = channelItems
      .filter(i => i.isVariable && i.costType === 'rate')
      .map(i => ({ name: i.costName, rate: i.amount }));
    const variablePerOrderItems = channelItems
      .filter(i => i.isVariable && i.costType === 'per_order')
      .map(i => ({ name: i.costName, amount: i.amount }));
    const fixedMonthlyItems = channelItems
      .filter(i => !i.isVariable || i.costType === 'monthly_fixed')
      .map(i => ({ name: i.costName, amount: i.amount }));

    const pricing = pricingSettings.find(p => p.channelName === channelName);

    summaries.push({
      channelName,
      variableRateItems,
      variablePerOrderItems,
      fixedMonthlyItems,
      totalVariableRatePct: variableRateItems.reduce((s, i) => s + i.rate, 0),
      totalVariablePerOrder: variablePerOrderItems.reduce((s, i) => s + i.amount, 0),
      totalFixedMonthly: fixedMonthlyItems.reduce((s, i) => s + i.amount, 0),
      discountRate: pricing?.discountRate ?? 0,
      commissionRate: pricing?.commissionRate ?? 0,
      promotionDiscountRate: pricing?.promotionDiscountRate ?? 0,
    });
  });

  return summaries;
}

export const ChannelCostAdmin: React.FC = () => {
  const [items, setItems] = useState<ChannelCostItem[]>(() => loadChannelCosts());
  const [pricing, setPricing] = useState<ChannelPricingSetting[]>(() => loadChannelPricing());
  const [newChannelName, setNewChannelName] = useState('');
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  useEffect(() => {
    saveChannelCosts(items);
  }, [items]);

  useEffect(() => {
    saveChannelPricing(pricing);
  }, [pricing]);

  const handlePricingUpdate = (channelName: string, field: 'discountRate' | 'commissionRate' | 'promotionDiscountRate', value: number) => {
    setPricing(prev => {
      const exists = prev.find(p => p.channelName === channelName);
      if (exists) {
        return prev.map(p => p.channelName === channelName ? { ...p, [field]: value } : p);
      }
      return [...prev, { channelName, discountRate: 0, commissionRate: 0, promotionDiscountRate: 0, [field]: value }];
    });
  };

  // 채널 목록 (순서 유지)
  const channelNames = [...new Set(items.map(i => i.channelName))];

  const toggleChannel = (name: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleUpdate = (id: string, field: keyof ChannelCostItem, value: string | number | boolean) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleAddItem = (channelName: string) => {
    setItems(prev => [...prev, {
      id: generateId(),
      channelName,
      costName: '',
      costType: 'rate' as CostType,
      amount: 0,
      isVariable: true,
    }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddChannel = () => {
    const name = newChannelName.trim();
    if (!name || channelNames.includes(name)) return;
    setItems(prev => [...prev, {
      id: generateId(),
      channelName: name,
      costName: '',
      costType: 'rate' as CostType,
      amount: 0,
      isVariable: true,
    }]);
    setExpandedChannels(prev => new Set(prev).add(name));
    setNewChannelName('');
  };

  const handleRemoveChannel = (channelName: string) => {
    if (!window.confirm(`"${channelName}" 채널의 모든 비용 항목을 삭제하시겠습니까?`)) return;
    setItems(prev => prev.filter(item => item.channelName !== channelName));
  };

  const handleReset = () => {
    if (!window.confirm('채널 비용 설정을 기본값으로 초기화하시겠습니까?')) return;
    setItems(DEFAULT_ITEMS.map(c => ({ ...c })));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center">
            <span className="material-icons-outlined mr-2">store</span>
            채널별 비용 관리
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            판매 채널별 비용 항목을 등록합니다. 변동비는 2단계 이익, 고정비는 3단계 이익 계산에 반영됩니다.
          </p>
        </div>

        <div className="p-4 space-y-3">
          {channelNames.map(channelName => {
            const channelItems = items.filter(i => i.channelName === channelName);
            const isExpanded = expandedChannels.has(channelName);
            const varTotal = channelItems.filter(i => i.isVariable && i.costType === 'rate').reduce((s, i) => s + i.amount, 0);
            const perOrderTotal = channelItems.filter(i => i.isVariable && i.costType === 'per_order').reduce((s, i) => s + i.amount, 0);
            const fixedTotal = channelItems.filter(i => !i.isVariable || i.costType === 'monthly_fixed').reduce((s, i) => s + i.amount, 0);

            return (
              <div key={channelName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* 채널 헤더 */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer select-none"
                  onClick={() => toggleChannel(channelName)}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-sm text-gray-500">
                      {isExpanded ? 'expand_more' : 'chevron_right'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{channelName}</span>
                    <span className="text-xs text-gray-500">{channelItems.length}개 항목</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {varTotal > 0 && <span>수수료 {varTotal}%</span>}
                    {perOrderTotal > 0 && <span>건당 {perOrderTotal.toLocaleString()}원</span>}
                    {fixedTotal > 0 && <span>고정 {fixedTotal.toLocaleString()}원/월</span>}
                    <button
                      onClick={e => { e.stopPropagation(); handleRemoveChannel(channelName); }}
                      className="text-red-400 hover:text-red-600 ml-2"
                      title="채널 삭제"
                    >
                      <span className="material-icons-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>

                {/* 비용 항목 상세 */}
                {isExpanded && (
                  <div className="p-3">
                    {/* 할인/수수료 설정 */}
                    <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                        <span className="material-icons-outlined text-xs align-middle mr-1">percent</span>
                        할인/수수료 설정 (권장판매가 대비)
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-xs">할인율</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={pricing.find(p => p.channelName === channelName)?.discountRate ?? 0}
                            onChange={e => handlePricingUpdate(channelName, 'discountRate', Number(e.target.value))}
                            className="w-20 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-xs">플랫폼 수수료율</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={pricing.find(p => p.channelName === channelName)?.commissionRate ?? 0}
                            onChange={e => handlePricingUpdate(channelName, 'commissionRate', Number(e.target.value))}
                            className="w-20 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-xs">할인매출비율</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={pricing.find(p => p.channelName === channelName)?.promotionDiscountRate ?? 0}
                            onChange={e => handlePricingUpdate(channelName, 'promotionDiscountRate', Number(e.target.value))}
                            className="w-20 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </label>
                        <span className="text-[10px] text-gray-400">공급가액 대비 할인매출 비율 (정산매출 = 공급가액 × (1 - 비율))</span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                          <th className="text-left py-2 px-2">비용 항목</th>
                          <th className="text-center py-2 px-2">비용 유형</th>
                          <th className="text-right py-2 px-2">금액/비율</th>
                          <th className="text-center py-2 px-2">변동/고정</th>
                          <th className="text-center py-2 px-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelItems.map(item => (
                          <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800">
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={item.costName}
                                onChange={e => handleUpdate(item.id, 'costName', e.target.value)}
                                placeholder="항목명"
                                className="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <select
                                value={item.costType}
                                onChange={e => handleUpdate(item.id, 'costType', e.target.value)}
                                className="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border"
                              >
                                {Object.entries(COST_TYPE_LABELS).map(([key, label]) => (
                                  <option key={key} value={key}>{label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  step={item.costType === 'rate' ? '0.1' : '100'}
                                  min="0"
                                  value={item.amount}
                                  onChange={e => handleUpdate(item.id, 'amount', Number(e.target.value))}
                                  className="w-24 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border"
                                />
                                <span className="text-xs text-gray-400 w-6">
                                  {item.costType === 'rate' ? '%' : '원'}
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                onClick={() => handleUpdate(item.id, 'isVariable', !item.isVariable)}
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  item.isVariable
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                }`}
                              >
                                {item.isVariable ? '변동' : '고정'}
                              </button>
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <span className="material-icons-outlined text-sm">close</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      onClick={() => handleAddItem(channelName)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center"
                    >
                      <span className="material-icons-outlined text-sm mr-1">add</span>
                      항목 추가
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* 채널 추가 */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="새 채널명"
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddChannel()}
              className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm text-sm p-2 border flex-1 max-w-xs"
            />
            <button
              onClick={handleAddChannel}
              disabled={!newChannelName.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
            >
              <span className="material-icons-outlined text-sm mr-1">add</span>
              채널 추가
            </button>
          </div>

          {/* 하단 */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="material-icons-outlined text-xs align-middle mr-1">info</span>
              변경사항은 자동 저장됩니다. 변동비→2단계 이익, 고정비→3단계 이익에 반영.
            </p>
            <button
              onClick={handleReset}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 flex items-center"
            >
              <span className="material-icons-outlined text-sm mr-1">restart_alt</span>
              기본값으로 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
