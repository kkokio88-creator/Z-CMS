/**
 * 노무비 관리 어드민
 * 반별(조별) 월간 노무 기록 입력 + 노무비 자동 계산
 * 명세서 §4.4 기반: 반별 생산성 관리
 */

import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from '../contexts/SettingsContext';

export interface LaborMonthlyRecord {
  id: string;
  month: string;         // YYYY-MM
  shiftName: string;     // 반 이름 (1반, 2반 등)
  headcount: number;     // 인원수
  workDays: number;      // 근무일수
  regularHoursPerDay: number;  // 1인당 일일 정규 시간
  overtimeHoursTotal: number;  // 반 전체 월 초과근무 시간 합계
}

/** 월별 노무비 요약 (insightService 연동용) */
export interface LaborMonthlySummary {
  month: string;
  totalHeadcount: number;
  totalRegularHours: number;   // 반 전체 정규 시간
  totalOvertimeHours: number;  // 반 전체 초과 시간
  regularCost: number;
  overtimeCost: number;
  totalCost: number;
  shifts: { name: string; headcount: number; cost: number }[];
}

const STORAGE_KEY = 'ZCMS_LABOR_RECORDS';

const DEFAULT_RECORDS: LaborMonthlyRecord[] = [];

function loadRecords(): LaborMonthlyRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [...DEFAULT_RECORDS];
}

function saveRecords(records: LaborMonthlyRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** insightService에서 사용: 월별 노무비 요약 */
export function getLaborMonthlySummaries(
  avgHourlyWage: number = 13000,
  overtimeMultiplier: number = 1.5
): LaborMonthlySummary[] {
  const records = loadRecords();
  if (records.length === 0) return [];

  // 월별 그룹핑
  const monthMap = new Map<string, LaborMonthlyRecord[]>();
  records.forEach(r => {
    const list = monthMap.get(r.month) || [];
    list.push(r);
    monthMap.set(r.month, list);
  });

  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, recs]) => {
      let totalHeadcount = 0;
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let regularCost = 0;
      let overtimeCost = 0;
      const shifts: { name: string; headcount: number; cost: number }[] = [];

      recs.forEach(r => {
        const regHours = r.headcount * r.workDays * r.regularHoursPerDay;
        const regCost = Math.round(regHours * avgHourlyWage);
        const otCost = Math.round(r.overtimeHoursTotal * avgHourlyWage * overtimeMultiplier);

        totalHeadcount += r.headcount;
        totalRegularHours += regHours;
        totalOvertimeHours += r.overtimeHoursTotal;
        regularCost += regCost;
        overtimeCost += otCost;

        shifts.push({ name: r.shiftName, headcount: r.headcount, cost: regCost + otCost });
      });

      return {
        month,
        totalHeadcount,
        totalRegularHours,
        totalOvertimeHours,
        regularCost,
        overtimeCost,
        totalCost: regularCost + overtimeCost,
        shifts,
      };
    });
}

/** 전체 기간 노무비 합계 (insightService 연동용) */
export function getTotalLaborCost(
  avgHourlyWage: number = 13000,
  overtimeMultiplier: number = 1.5
): number {
  const summaries = getLaborMonthlySummaries(avgHourlyWage, overtimeMultiplier);
  return summaries.reduce((sum, s) => sum + s.totalCost, 0);
}

/** 특정 월의 노무비 (insightService 연동용) */
export function getMonthlyLaborCost(
  month: string,
  avgHourlyWage: number = 13000,
  overtimeMultiplier: number = 1.5
): number | null {
  const summaries = getLaborMonthlySummaries(avgHourlyWage, overtimeMultiplier);
  const found = summaries.find(s => s.month === month);
  return found ? found.totalCost : null;
}

export const LaborRecordAdmin: React.FC = () => {
  const config = useBusinessConfig();
  const [records, setRecords] = useState<LaborMonthlyRecord[]>(() => loadRecords());
  const [editMonth, setEditMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  const currentMonthRecords = records.filter(r => r.month === editMonth);

  const addShift = () => {
    const shiftNum = currentMonthRecords.length + 1;
    const newRecord: LaborMonthlyRecord = {
      id: `${editMonth}-${Date.now()}`,
      month: editMonth,
      shiftName: `${shiftNum}반`,
      headcount: 5,
      workDays: 22,
      regularHoursPerDay: 8,
      overtimeHoursTotal: 0,
    };
    setRecords([...records, newRecord]);
  };

  const updateRecord = (id: string, field: keyof LaborMonthlyRecord, value: string | number) => {
    setRecords(records.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRecord = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
  };

  // 현재 월 노무비 계산
  const monthSummary = getLaborMonthlySummaries(config.avgHourlyWage, config.overtimeMultiplier)
    .find(s => s.month === editMonth);

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-icons-outlined text-purple-500">groups</span>
          노무비 관리 (반별 생산성)
        </h3>
        <span className="material-icons-outlined text-gray-400">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-gray-500">
            반별 근무 기록을 입력하면 실제 노무비로 원가를 계산합니다. 미입력 시 기존 추정비율({Math.round(config.laborCostRatio * 100)}%)이 적용됩니다.
          </p>

          {/* 월 선택 */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">대상월</label>
            <input
              type="month"
              value={editMonth}
              onChange={e => setEditMonth(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
            <button
              onClick={addShift}
              className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-md text-sm font-medium flex items-center gap-1"
            >
              <span className="material-icons-outlined text-sm">add</span>
              반 추가
            </button>
          </div>

          {/* 반별 기록 테이블 */}
          {currentMonthRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-500">반명</th>
                    <th className="text-right py-2 px-2 text-gray-500">인원</th>
                    <th className="text-right py-2 px-2 text-gray-500">근무일수</th>
                    <th className="text-right py-2 px-2 text-gray-500">일 정규(h)</th>
                    <th className="text-right py-2 px-2 text-gray-500">월 초과(h)</th>
                    <th className="text-right py-2 px-2 text-gray-500">예상 노무비</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthRecords.map(r => {
                    const regHours = r.headcount * r.workDays * r.regularHoursPerDay;
                    const regCost = Math.round(regHours * config.avgHourlyWage);
                    const otCost = Math.round(r.overtimeHoursTotal * config.avgHourlyWage * config.overtimeMultiplier);
                    const totalCost = regCost + otCost;
                    return (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={r.shiftName}
                            onChange={e => updateRecord(r.id, 'shiftName', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="1"
                            value={r.headcount}
                            onChange={e => updateRecord(r.id, 'headcount', Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={r.workDays}
                            onChange={e => updateRecord(r.id, 'workDays', Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={r.regularHoursPerDay}
                            onChange={e => updateRecord(r.id, 'regularHoursPerDay', Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            value={r.overtimeHoursTotal}
                            onChange={e => updateRecord(r.id, 'overtimeHoursTotal', Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-white">
                          {totalCost.toLocaleString()}원
                        </td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => removeRecord(r.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <span className="material-icons-outlined text-sm">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4 text-sm">
              {editMonth}월 노무 기록이 없습니다. "반 추가" 버튼으로 입력을 시작하세요.
            </p>
          )}

          {/* 월 합계 */}
          {monthSummary && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300">{editMonth} 노무비 합계</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">총 인원</p>
                  <p className="font-medium text-gray-900 dark:text-white">{monthSummary.totalHeadcount}명</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">정규 시간</p>
                  <p className="font-medium text-gray-900 dark:text-white">{monthSummary.totalRegularHours.toLocaleString()}h</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">초과 시간</p>
                  <p className="font-medium text-orange-600">{monthSummary.totalOvertimeHours.toLocaleString()}h</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">총 노무비</p>
                  <p className="font-bold text-purple-700 dark:text-purple-300">{monthSummary.totalCost.toLocaleString()}원</p>
                </div>
              </div>
              {monthSummary.shifts.length > 1 && (
                <div className="flex gap-3 text-xs mt-1">
                  {monthSummary.shifts.map(s => (
                    <span key={s.name} className="text-gray-500">{s.name}: {s.cost.toLocaleString()}원 ({s.headcount}명)</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
