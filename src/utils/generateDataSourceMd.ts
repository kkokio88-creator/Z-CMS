/**
 * 데이터 소스 설정으로부터 MD 문서를 자동 생성하는 유틸리티
 * 설정탭에서 수정 시 이 함수로 MD 텍스트를 재생성합니다.
 */

import type { DataSourceConfig, DataSourceSheet } from '../config/dataSourceConfig';

export function generateDataSourceMd(config: DataSourceConfig): string {
  const lines: string[] = [];

  lines.push('# Z-CMS 구글시트 데이터 소스 정규화 문서');
  lines.push('');
  lines.push('> 이 문서는 Z-CMS 설정 탭에서 자동 생성/관리됩니다.');
  lines.push(`> 마지막 업데이트: ${config.lastUpdated}`);
  lines.push(`> 서비스 계정: ${config.serviceAccount}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. 총괄 테이블
  lines.push('## 1. 데이터 소스 총괄');
  lines.push('');
  lines.push('| # | 데이터 | 스프레드시트 ID | 시트명 | 헤더행 | 데이터시작행 | 컬럼수 | 상태 |');
  lines.push('|---|--------|----------------|--------|--------|-------------|--------|------|');
  config.sheets.forEach((sheet, idx) => {
    lines.push(
      `| ${idx + 1} | ${sheet.name} | \`${sheet.spreadsheetId.slice(0, 16)}...\` | ${sheet.sheetName} | ${sheet.headerRow} | ${sheet.dataStartRow} | ${sheet.columns.length} | ${sheet.enabled ? '활성' : '비활성'} |`
    );
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // 2. 시트별 상세
  lines.push('## 2. 정규화 스키마 상세');
  lines.push('');
  config.sheets.forEach((sheet, idx) => {
    lines.push(`### 2.${idx + 1} ${sheet.name} (\`${sheet.id}\`)`);
    lines.push('');
    lines.push(`**시트**: ${sheet.sheetName} (ID: \`${sheet.spreadsheetId}\`)`);
    lines.push('');
    lines.push('| 정규화 필드 | 원본 컬럼 | 타입 | 설명 |');
    lines.push('|-------------|-----------|------|------|');
    sheet.columns.forEach(col => {
      lines.push(`| \`${col.key}\` | ${col.column}열 | \`${col.type}\` | ${col.label}${col.description ? ` — ${col.description}` : ''} |`);
    });
    if (sheet.notes) {
      lines.push('');
      lines.push(`> ${sheet.notes}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  // 3. 품목코드 체계
  lines.push('## 3. 품목코드 체계');
  lines.push('');
  lines.push('| 접두사 | 분류 | 설명 |');
  lines.push('|--------|------|------|');
  lines.push('| `RES_P_` | 완제품 | 최종 판매 상품 (밀키트) |');
  lines.push('| `BAN_P_` | 반가공품 | 반가공 판매 상품 |');
  lines.push('| `SAN_` | 반제품 | 반조리 중간제품 |');
  lines.push('| `ZIP_H_` | 반재료 | 반가공 재료 |');
  lines.push('| `ZIP_M_` | 원재료 | 원재료 (식자재) |');
  lines.push('| `ZIP_S_` | 부자재 | 포장재/소모품 |');
  lines.push('| `ZIP_A_` | 기타 | 배송비 등 |');
  lines.push('');

  // 4. 데이터 정제 규칙
  lines.push('## 4. 데이터 정제 규칙');
  lines.push('');
  lines.push('1. **숫자 파싱**: 쉼표(,), 공백, 원(원) 제거 후 parseFloat');
  lines.push('2. **날짜 정규화**: 모든 날짜를 YYYY-MM-DD 형식으로 통일');
  lines.push('3. **빈 값 처리**: 숫자=0, 문자열=""');
  lines.push('4. **에러 값**: #DIV/0!, #N/A → 0 또는 null');
  lines.push('5. **소계 행 제외**: 월별 소계 텍스트 포함 행 건너뜀');
  lines.push('');

  return lines.join('\n');
}

/** MD 내용을 localStorage에 캐시 (프론트에서 다운로드용) */
export function saveMdToStorage(mdContent: string): void {
  localStorage.setItem('Z_CMS_DATA_SOURCE_MD', mdContent);
}

export function loadMdFromStorage(): string | null {
  return localStorage.getItem('Z_CMS_DATA_SOURCE_MD');
}
