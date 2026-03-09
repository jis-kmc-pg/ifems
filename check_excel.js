const XLSX = require('xlsx');

const wb = XLSX.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('=== 첫 15행 확인 (Raw Data) ===');
rawData.slice(0, 15).forEach((row, i) => {
  const preview = row.slice(0, 10).map(c => c || '').join(' | ');
  console.log(`Row ${i}: ${preview}`);
});

// PLANT_CODE가 있는 행 찾기
const headerRowIndex = rawData.findIndex(row =>
  row.includes('PLANT_CODE') || row.includes('P_GROUP_CODE')
);

console.log(`\n헤더 행 인덱스: ${headerRowIndex}`);

if (headerRowIndex >= 0) {
  console.log('\n=== 헤더 ===');
  console.log(rawData[headerRowIndex]);
}
