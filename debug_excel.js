const XLSX = require('xlsx');

const wb = XLSX.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { range: 7 });

console.log(`총 데이터 행 수: ${data.length}\n`);

console.log('=== 첫 20개 행 샘플 ===');
data.slice(0, 20).forEach((row, i) => {
  console.log(`Row ${i}:`);
  console.log(`  PLANT_CODE: ${row.PLANT_CODE}`);
  console.log(`  P_GROUP_CODE: ${row.P_GROUP_CODE}`);
  console.log(`  GROUP_CODE: ${row.GROUP_CODE}`);
  console.log(`  GROUP_NAME: ${row.GROUP_NAME}`);
  console.log(`  DEPTH: ${row.DEPTH} (type: ${typeof row.DEPTH})`);
  console.log(`  DATA_TYPE: ${row.DATA_TYPE} (type: ${typeof row.DATA_TYPE})`);
  console.log(`  USE_YN: ${row.USE_YN} (type: ${typeof row.USE_YN})`);
  console.log('');
});

// P_GROUP_CODE가 BLOCK인 행 찾기
console.log('\n=== P_GROUP_CODE=BLOCK인 행 (최대 10개) ===');
const blockRows = data.filter(r => r.P_GROUP_CODE === 'BLOCK').slice(0, 10);
blockRows.forEach((row, i) => {
  console.log(`Row ${i}: CODE=${row.GROUP_CODE}, DEPTH=${row.DEPTH}, DATA_TYPE=${row.DATA_TYPE}, USE_YN=${row.USE_YN}`);
});
