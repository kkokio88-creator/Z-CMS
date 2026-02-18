export function exportViewToCsv(activeView: string, dataMap: Record<string, any[]>) {
  const dataToExport = dataMap[activeView] || [{ message: 'No exportable data for this view' }];
  const filename = `export_${activeView}_${new Date().toISOString().slice(0, 10)}.csv`;

  if (dataToExport.length === 0) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const headers = Object.keys(dataToExport[0]).join(',');
  const rows = dataToExport.map((row: any) => Object.values(row).join(',')).join('\n');
  const csvContent = `data:text/csv;charset=utf-8,\uFEFF${headers}\n${rows}`;

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
