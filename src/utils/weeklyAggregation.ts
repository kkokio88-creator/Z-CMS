/**
 * 주간 집계 유틸리티 — 모든 뷰에서 일별→주간 변환에 사용
 */

/** 주간 라벨 생성: "MM/DD~MM/DD" */
export function getWeekLabel(startDate: Date, endDate?: Date): string {
  const s = `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;
  if (endDate) {
    const e = `${String(endDate.getMonth() + 1).padStart(2, '0')}/${String(endDate.getDate()).padStart(2, '0')}`;
    return `${s}~${e}`;
  }
  return `${s}~`;
}

/** 날짜 문자열(YYYY-MM-DD)을 해당 주의 월요일 날짜로 변환 */
export function getMonday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 일요일이면 -6
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

/** 주간 키 생성 (월요일 날짜 기준) */
export function getWeekKey(dateStr: string): string {
  const monday = getMonday(dateStr);
  return monday.toISOString().slice(0, 10);
}

/**
 * 날짜가 있는 데이터 배열을 주간(월~일) 단위로 그룹핑
 * @param data 날짜 필드를 가진 배열
 * @param dateKey 날짜 필드 키
 * @returns Map<주간키, 데이터배열>
 */
export function groupByWeek<T>(data: T[], dateKey: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>();
  data.forEach(item => {
    const dateStr = String(item[dateKey]);
    const key = getWeekKey(dateStr);
    const arr = map.get(key) || [];
    arr.push(item);
    map.set(key, arr);
  });
  return map;
}

/**
 * 주간 그룹의 라벨 생성 (월요일~일요일)
 */
export function weekKeyToLabel(weekKey: string): string {
  const monday = new Date(weekKey);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return getWeekLabel(monday, sunday);
}

/**
 * 정렬된 주간 엔트리를 반환
 */
export function getSortedWeekEntries<T>(weekMap: Map<string, T[]>): [string, T[]][] {
  return Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export interface WeeklyNumericEntry {
  weekKey: string;
  weekLabel: string;
  [key: string]: string | number;
}

/**
 * 숫자 필드를 합산하는 주간 집계 (범용)
 * @param data 날짜 필드를 가진 배열
 * @param dateKey 날짜 필드 키
 * @param sumKeys 합산할 숫자 필드 키 배열
 */
export function aggregateWeekly<T extends Record<string, any>>(
  data: T[],
  dateKey: keyof T,
  sumKeys: (keyof T)[],
): WeeklyNumericEntry[] {
  const weekMap = groupByWeek(data, dateKey);
  const sorted = getSortedWeekEntries(weekMap);

  return sorted.map(([weekKey, items]) => {
    const entry: WeeklyNumericEntry = {
      weekKey,
      weekLabel: weekKeyToLabel(weekKey),
    };
    sumKeys.forEach(key => {
      entry[key as string] = items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
    });
    return entry;
  });
}
