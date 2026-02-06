/**
 * 숫자를 한국식 통화 형식으로 포맷 (억, 만 단위)
 * @param value 포맷할 숫자
 * @returns 포맷된 문자열 (예: "1.2억", "3,800만", "1,234")
 */
export const formatCurrency = (value: number): string => {
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
