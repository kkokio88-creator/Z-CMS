/**
 * 채널 비용 관리 어드민
 * 채널별 변동비/고정비를 입력·관리하는 화면
 */

import React, { useState, useEffect } from 'react';

export interface ChannelCostEntry {
  channelName: string;
  variableRatePct: number;   // 매출대비 변동비 %
  variablePerOrder: number;  // 건당 변동비 원
  fixedMonthly: number;      // 월 고정비 원
}

const DEFAULT_CHANNELS: ChannelCostEntry[] = [
  { channelName: '자사몰', variableRatePct: 5, variablePerOrder: 0, fixedMonthly: 0 },
  { channelName: '쿠팡', variableRatePct: 15, variablePerOrder: 500, fixedMonthly: 300000 },
  { channelName: '컬리', variableRatePct: 20, variablePerOrder: 800, fixedMonthly: 500000 },
];

const STORAGE_KEY = 'ZCMS_CHANNEL_COSTS';

function loadChannelCosts(): ChannelCostEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_CHANNELS.map(c => ({ ...c }));
}

function saveChannelCosts(entries: ChannelCostEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const ChannelCostAdmin: React.FC = () => {
  const [entries, setEntries] = useState<ChannelCostEntry[]>(() => loadChannelCosts());
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    saveChannelCosts(entries);
  }, [entries]);

  const handleUpdate = (idx: number, field: keyof ChannelCostEntry, value: string | number) => {
    setEntries(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleAddChannel = () => {
    const name = newChannelName.trim();
    if (!name || entries.some(e => e.channelName === name)) return;
    setEntries(prev => [...prev, { channelName: name, variableRatePct: 0, variablePerOrder: 0, fixedMonthly: 0 }]);
    setNewChannelName('');
  };

  const handleRemove = (idx: number) => {
    if (!window.confirm(`"${entries[idx].channelName}" 채널을 삭제하시겠습니까?`)) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleReset = () => {
    if (!window.confirm('채널 비용 설정을 기본값으로 초기화하시겠습니까?')) return;
    const defaults = DEFAULT_CHANNELS.map(c => ({ ...c }));
    setEntries(defaults);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center">
            <span className="material-icons-outlined mr-2">store</span>
            채널별 비용 관리
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            판매 채널별 변동비와 고정비를 설정합니다. 수익 분석에 자동 반영됩니다.
          </p>
        </div>

        <div className="p-6">
          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">채널명</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">변동비 (%)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">건당 비용 (원)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">월 고정비 (원)</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-600 dark:text-gray-400">삭제</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.channelName} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{entry.channelName}</td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={entry.variableRatePct}
                        onChange={e => handleUpdate(idx, 'variableRatePct', Number(e.target.value))}
                        className="w-20 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border ml-auto block"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={entry.variablePerOrder}
                        onChange={e => handleUpdate(idx, 'variablePerOrder', Number(e.target.value))}
                        className="w-24 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border ml-auto block"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="10000"
                        min="0"
                        value={entry.fixedMonthly}
                        onChange={e => handleUpdate(idx, 'fixedMonthly', Number(e.target.value))}
                        className="w-28 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border ml-auto block"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => handleRemove(idx)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="삭제"
                      >
                        <span className="material-icons-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 채널 추가 */}
          <div className="mt-4 flex items-center gap-2">
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
              추가
            </button>
          </div>

          {/* 하단 액션 */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="material-icons-outlined text-xs align-middle mr-1">info</span>
              변경사항은 자동 저장됩니다.
            </p>
            <button
              onClick={handleReset}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center"
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
