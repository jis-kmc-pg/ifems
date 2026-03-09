const XLSX = require('xlsx');

const wb = XLSX.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const headerRow = rawData.find(row => row.includes('PLANT_CODE'));
const headerIndex = rawData.indexOf(headerRow);
const headers = headerRow;

const pGroupCodeIdx = headers.indexOf('P_GROUP_CODE');
const groupCodeIdx = headers.indexOf('GROUP_CODE');
const depthIdx = headers.indexOf('DEPTH');
const useYnIdx = headers.indexOf('USE_YN');
const dataTypeIdx = headers.indexOf('DATA_TYPE');

console.log('=== P_GROUP_CODE=BLOCK인 처음 20개 행 ===\n');

let count = 0;
for (let i = headerIndex + 1; i < rawData.length && count < 20; i++) {
  const row = rawData[i];
  const pGroupCode = row[pGroupCodeIdx];

  if (pGroupCode === 'BLOCK') {
    count++;
    const depth = row[depthIdx];
    const dataType = row[dataTypeIdx];
    const useYn = row[useYnIdx];
    const groupCode = row[groupCodeIdx];

    console.log(`Row ${i}:`);
    console.log(`  GROUP_CODE: ${groupCode}`);
    console.log(`  DEPTH: ${depth} (type: ${typeof depth})`);
    console.log(`  DATA_TYPE: ${dataType} (type: ${typeof dataType})`);
    console.log(`  USE_YN: ${useYn} (type: ${typeof useYn})`);
    console.log(`  조건 충족: ${depth === 2 && dataType === 'G' && useYn === 1}`);
    console.log('');
  }
}
