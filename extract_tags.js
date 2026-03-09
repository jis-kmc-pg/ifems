const xlsx = require('xlsx');
const fs = require('fs');

console.log('=== 태그 데이터 추출 시작 ===\n');

const wb = xlsx.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, {header: 1, defval: ''});

// Column indices
const COL = {
  PLANT_CODE: 0,
  P_GROUP_CODE: 1,
  P_GROUP_NAME: 2,
  GROUP_CODE: 3,
  GROUP_NAME: 4,
  TAG_NAME: 5,
  DEPTH: 6,
  ORDER: 7,
  USE_YN: 8,
  TAG_TYPE: 9,
  ENERGY_TYPE: 10,
  TYPE: 11,
  DATA_TYPE: 12,
};

const tags = [];
const facilityMap = new Map(); // GROUP_CODE (설비 코드) 매핑

// DEPTH=2 (설비) 매핑 먼저 구축
data.slice(8).forEach(row => {
  const depth = String(row[COL.DEPTH]);
  const useYn = String(row[COL.USE_YN]);
  const dataType = String(row[COL.DATA_TYPE]);
  const groupCode = String(row[COL.GROUP_CODE]);

  if (depth === '2' && useYn === '1' && dataType === 'G') {
    // 설비 코드를 하이픈 형식으로 변환 (HNK10_010_1 → HNK10-010-1)
    const facilityCode = groupCode.replace(/_/g, '-');
    facilityMap.set(groupCode, facilityCode);
  }
});

console.log(`설비 매핑 개수: ${facilityMap.size}\n`);

// DEPTH=3 (태그) 추출
let extractedCount = 0;
let skippedCount = 0;
const stats = {
  tagTypes: {},
  energyTypes: {},
  dataTypes: {},
  missingFacility: new Set(),
};

data.slice(8).forEach((row, idx) => {
  const depth = String(row[COL.DEPTH]);
  const useYn = String(row[COL.USE_YN]);
  const pGroupCode = String(row[COL.P_GROUP_CODE]); // 부모 = 설비
  const tagName = String(row[COL.TAG_NAME]);
  const groupName = String(row[COL.GROUP_NAME]);
  const tagType = String(row[COL.TAG_TYPE]);
  const energyType = String(row[COL.ENERGY_TYPE]);
  const dataType = String(row[COL.DATA_TYPE]);

  if (depth !== '3') return;

  // USE_YN=0인 태그는 스킵
  if (useYn === '0') {
    skippedCount++;
    return;
  }

  // 부모 설비 코드 확인
  if (!facilityMap.has(pGroupCode)) {
    stats.missingFacility.add(pGroupCode);
    skippedCount++;
    return;
  }

  const facilityCode = facilityMap.get(pGroupCode);

  // 태그 데이터 추출
  const tag = {
    tagName: tagName || `${pGroupCode}_TAG_${idx}`,
    displayName: groupName || tagName || '이름 없음',
    facilityCode: facilityCode,
    pGroupCode: pGroupCode, // 원본 부모 코드 (디버깅용)
    tagType: tagType || 'TREND',
    energyType: energyType || null,
    dataType: dataType || 'T',
    order: extractedCount + 1,
  };

  tags.push(tag);
  extractedCount++;

  // 통계
  stats.tagTypes[tag.tagType] = (stats.tagTypes[tag.tagType] || 0) + 1;
  if (tag.energyType) {
    stats.energyTypes[tag.energyType] = (stats.energyTypes[tag.energyType] || 0) + 1;
  }
  stats.dataTypes[tag.dataType] = (stats.dataTypes[tag.dataType] || 0) + 1;
});

console.log('=== 추출 결과 ===');
console.log(`추출된 태그 개수: ${extractedCount}`);
console.log(`스킵된 태그 개수: ${skippedCount}`);

console.log('\n=== TAG_TYPE 분포 ===');
Object.keys(stats.tagTypes).forEach(k =>
  console.log(`${k}: ${stats.tagTypes[k]}개`)
);

console.log('\n=== ENERGY_TYPE 분포 ===');
Object.keys(stats.energyTypes).forEach(k =>
  console.log(`${k}: ${stats.energyTypes[k]}개`)
);

console.log('\n=== DATA_TYPE 분포 ===');
Object.keys(stats.dataTypes).forEach(k =>
  console.log(`${k}: ${stats.dataTypes[k]}개`)
);

if (stats.missingFacility.size > 0) {
  console.log('\n⚠️ 설비를 찾을 수 없는 부모 코드:');
  stats.missingFacility.forEach(code => console.log(`  - ${code}`));
}

// JSON 파일로 저장
const outputFile = 'tags_extracted.json';
fs.writeFileSync(outputFile, JSON.stringify(tags, null, 2));
console.log(`\n✅ 저장 완료: ${outputFile}`);

// 설비별 태그 개수 통계
const facilityTagCount = {};
tags.forEach(tag => {
  facilityTagCount[tag.facilityCode] = (facilityTagCount[tag.facilityCode] || 0) + 1;
});

console.log('\n=== 설비별 태그 개수 (상위 20개) ===');
Object.entries(facilityTagCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([facilityCode, count]) => {
    console.log(`${facilityCode}: ${count}개`);
  });

// 샘플 태그 10개 출력
console.log('\n=== 샘플 태그 (처음 10개) ===');
tags.slice(0, 10).forEach((tag, idx) => {
  console.log(`${idx + 1}. ${tag.tagName}`);
  console.log(`   Display: ${tag.displayName}`);
  console.log(`   Facility: ${tag.facilityCode}`);
  console.log(`   Type: ${tag.tagType}, Energy: ${tag.energyType || 'N/A'}, Data: ${tag.dataType}`);
  console.log('');
});

console.log('=== 완료 ===');
