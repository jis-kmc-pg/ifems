const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../../../Tag/화성PT4공장_TagList.xlsx');
console.log('Reading Excel file:', excelPath);

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
console.log('Sheet name:', sheetName);

const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('\nRows 8-12 (around header):');
data.slice(7, 12).forEach((row, i) => {
  console.log(`Row ${i + 8}:`, row);
});

console.log('\nTotal rows:', data.length);

// Parse as JSON starting from row 9 (index 8)
const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 8 });
console.log('\nFirst record (JSON from row 9):');
console.log(JSON.stringify(jsonData[0], null, 2));

console.log('\nField names:');
console.log(Object.keys(jsonData[0]));

console.log('\nTotal data records:', jsonData.length);
