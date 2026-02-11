/**
 * 날짜 범위 필터 — 전역 공유 유틸리티
 * 모든 뷰에서 동일한 날짜 범위 로직을 사용합니다.
 */

export type DateRangeOption = '7days' | '30days' | 'lastMonth' | 'thisMonth';

export const DATE_RANGE_OPTIONS: { key: DateRangeOption; label: string }[] = [
  { key: '7days', label: '최근 7일' },
  { key: '30days', label: '최근 30일' },
  { key: 'lastMonth', label: '지난달' },
  { key: 'thisMonth', label: '이번달' },
];

/** 어제 기준 날짜 범위 계산 */
export function getDateRange(option: DateRangeOption): { start: string; end: string; days: number } {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  // 로컬 타임존 기준 (toISOString은 UTC 변환으로 KST에서 하루 밀림 방지)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (option) {
    case '7days': {
      const start = new Date(yesterday);
      start.setDate(start.getDate() - 6);
      return { start: fmt(start), end: fmt(yesterday), days: 7 };
    }
    case '30days': {
      const start = new Date(yesterday);
      start.setDate(start.getDate() - 29);
      return { start: fmt(start), end: fmt(yesterday), days: 30 };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      const days = end.getDate();
      return { start: fmt(start), end: fmt(end), days };
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const days = Math.max(1, yesterday.getDate() - start.getDate() + 1);
      return { start: fmt(start), end: fmt(yesterday), days };
    }
  }
}

/** date 필드 기준 범위 필터 */
export function filterByDate<T extends { date: string }>(data: T[], start: string, end: string): T[] {
  return data.filter(d => d.date >= start && d.date <= end);
}

/** 범위 라벨 텍스트 (예: "1/12 ~ 2/10") */
export function getRangeLabel(option: DateRangeOption): string {
  const { start, end } = getDateRange(option);
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`;
}
