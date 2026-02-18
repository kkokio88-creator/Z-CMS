/**
 * ECOUNT YYYYMMDD → YYYY-MM-DD (ISO 형식)
 */
export function formatDateISO(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/**
 * ECOUNT YYYYMMDD → MM/DD (표시용)
 */
export function formatDateDisplay(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;
  }
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  }
  return dateStr;
}
