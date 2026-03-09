const XLSX = require('xlsx');

const workbook = XLSX.readFile('Tag/화성PT4공장_TagList.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { range: 8 });

console.log('총', data.length, '개 태그');

// DEPTH=3인 태그만 추출 (실제 태그)
const tags = data.filter(row => row.DEPTH === '3' || row.DEPTH === 3);
console.log('실제 태그(DEPTH=3):', tags.length, '개');

const samples = { TREND: [], USAGE: [], OPERATE: [], SENSOR: [], CONTROL: [] };
const stats = { TREND: 0, USAGE: 0, OPERATE: 0, SENSOR: 0, CONTROL: 0 };
const energyStats = { elec: 0, air: 0, gas: 0, solar: 0 };

tags.forEach((row) => {
  const tagType = row.TAG_TYPE;
  const tagName = row.TAG_NAME;
  const energyType = row.ENERGY_TYPE;
  const depth = row.DEPTH;

  if (tagType && stats[tagType] !== undefined) {
    stats[tagType]++;
    if (tagName && samples[tagType].length < 5) {
      samples[tagType].push({ name: tagName, type: tagType, energy: energyType, depth });
    }
  }

  if (energyType && energyStats[energyType] !== undefined) {
    energyStats[energyType]++;
  }
});

console.log('\n=== 에너지 종류별 통계 ===');
Object.keys(energyStats).forEach(type => {
  console.log(`${type}: ${energyStats[type]}개`);
});

console.log('\n=== 태그 종류별 통계 ===');
Object.keys(stats).forEach(type => {
  console.log(`${type}: ${stats[type]}개`);
});

console.log('\n=== 태그 종류별 샘플 ===');
Object.keys(samples).forEach(type => {
  if (samples[type].length > 0) {
    console.log(`\n[${type}]:`);
    samples[type].forEach(t => {
      console.log(`  - ${t.name} (에너지: ${t.energy || 'N/A'}, DEPTH: ${t.depth})`);
    });
  }
});
