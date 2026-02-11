/**
 * 숫자를 한국식 통화 형식으로 포맷 (억, 만 단위)
 * @param value 포맷할 숫자
 * @returns 포맷된 문자열 (예: "1.2억", "3,800만", "1,234")
 */
export const formatCurrency = (value: number): string => {
  if (value == null || isNaN(value)) return '0';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 100000000) {
    // 1억 이상
    return `${sign}${(absValue / 100000000).toFixed(1)}억`;
  } else if (absValue >= 10000) {
    // 1만 이상
    return `${sign}${(absValue / 10000).toFixed(0)}만`;
  }
  return value.toLocaleString('ko-KR');
};

/**
 * 숫자를 수량 형식으로 포맷 (단순 콤마 구분)
 * @param value 포맷할 숫자
 * @returns 포맷된 문자열 (예: "1,234")
 */
export const formatNumber = (value: number): string => {
  return value.toLocaleString('ko-KR');
};

/**
 * 차트 축용 통화 포맷 (억/만/원)
 * @param value 포맷할 숫자
 * @returns "1.2억", "500만", "9,800"
 */
export const formatAxisKRW = (value: number): string => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 100000000) {
    return `${sign}${(absValue / 100000000).toFixed(1)}억`;
  } else if (absValue >= 10000000) {
    return `${sign}${(absValue / 10000000).toFixed(1)}천만`;
  } else if (absValue >= 10000) {
    return `${sign}${(absValue / 10000).toFixed(0)}만`;
  }
  return `${sign}${absValue.toLocaleString('ko-KR')}`;
};

/**
 * 퍼센트 포맷
 * @param value 0~100 범위의 퍼센트 값
 * @param decimals 소수점 자릿수 (기본 1)
 * @returns "23.5%"
 */
export const formatPercent = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * 수량 + 단위 포맷
 * @param value 수량
 * @param unit 단위 (기본 "개")
 * @returns "1,234개", "500kg"
 */
export const formatQty = (value: number, unit = '개'): string => {
  return `${value.toLocaleString('ko-KR')}${unit}`;
};
