const xlsx = require('xlsx');
const fs = require('fs');

const wb = xlsx.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, {header: 1, defval: ''});

console.log('=== TagList.xlsx Structure Analysis ===\n');
console.log('Total rows:', data.length);
console.log('\nHeader (row 8):', data[7].join(' | '));

// Column indices based on header
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

const depths = {};
const dataTypes = {};
const tagTypes = {};
const useYn = {};
const energyTypes = {};

data.slice(8).forEach(row => {
  const depth = String(row[COL.DEPTH] || '');
  const dataType = String(row[COL.DATA_TYPE] || '');
  const tagType = String(row[COL.TAG_TYPE] || '');
  const use = String(row[COL.USE_YN] || '');
  const energyType = String(row[COL.ENERGY_TYPE] || '');

  if(depth) depths[depth] = (depths[depth] || 0) + 1;
  if(dataType) dataTypes[dataType] = (dataTypes[dataType] || 0) + 1;
  if(tagType) tagTypes[tagType] = (tagTypes[tagType] || 0) + 1;
  if(use) useYn[use] = (useYn[use] || 0) + 1;
  if(energyType) energyTypes[energyType] = (energyTypes[energyType] || 0) + 1;
});

console.log('\n=== DEPTH Distribution ===');
Object.keys(depths).sort((a,b) => Number(a) - Number(b)).forEach(k =>
  console.log(`DEPTH ${k}: ${depths[k]} rows`)
);

console.log('\n=== DATA_TYPE Distribution ===');
Object.keys(dataTypes).forEach(k =>
  console.log(`DATA_TYPE ${k}: ${dataTypes[k]} rows`)
);

console.log('\n=== TAG_TYPE Distribution ===');
Object.keys(tagTypes).forEach(k =>
  console.log(`TAG_TYPE ${k}: ${tagTypes[k]} rows`)
);

console.log('\n=== USE_YN Distribution ===');
Object.keys(useYn).forEach(k =>
  console.log(`USE_YN ${k}: ${useYn[k]} rows`)
);

console.log('\n=== ENERGY_TYPE Distribution ===');
Object.keys(energyTypes).forEach(k =>
  console.log(`ENERGY_TYPE ${k}: ${energyTypes[k]} rows`)
);

// Hierarchy structure samples
console.log('\n=== Hierarchy Structure (First 50 rows) ===');
data.slice(8, 58).forEach((row, idx) => {
  const depth = row[COL.DEPTH];
  const groupCode = row[COL.GROUP_CODE];
  const groupName = row[COL.GROUP_NAME];
  const tagName = row[COL.TAG_NAME];
  const dataType = row[COL.DATA_TYPE];
  const useYn = row[COL.USE_YN];

  console.log(`Row ${idx+9}: DEPTH=${depth}, CODE=${groupCode}, NAME=${groupName}, TAG=${tagName}, DATA_TYPE=${dataType}, USE=${useYn}`);
});

// Extract hierarchy by DEPTH
console.log('\n=== Extracting Hierarchy by DEPTH ===');

const hierarchy = {
  factories: [],  // DEPTH=0
  lines: [],      // DEPTH=1
  processes: [],  // DEPTH=2
  facilities: [], // DEPTH=3
  tags: []        // DEPTH=4
};

data.slice(8).forEach(row => {
  const depth = String(row[COL.DEPTH]);
  const useYn = String(row[COL.USE_YN]);
  const dataType = String(row[COL.DATA_TYPE]);

  if (useYn !== '1') return; // Skip unused items

  const item = {
    plantCode: row[COL.PLANT_CODE],
    pGroupCode: row[COL.P_GROUP_CODE],
    pGroupName: row[COL.P_GROUP_NAME],
    groupCode: row[COL.GROUP_CODE],
    groupName: row[COL.GROUP_NAME],
    tagName: row[COL.TAG_NAME],
    depth: depth,
    order: row[COL.ORDER],
    tagType: row[COL.TAG_TYPE],
    energyType: row[COL.ENERGY_TYPE],
    type: row[COL.TYPE],
    dataType: dataType,
  };

  switch(depth) {
    case '0':
      hierarchy.factories.push(item);
      break;
    case '1':
      hierarchy.lines.push(item);
      break;
    case '2':
      hierarchy.processes.push(item);
      break;
    case '3':
      if (dataType === 'G') { // Group (Facility)
        hierarchy.facilities.push(item);
      }
      break;
    case '4':
      if (dataType === 'T') { // Tag
        hierarchy.tags.push(item);
      }
      break;
  }
});

console.log('\n=== Hierarchy Summary ===');
console.log(`Factories (DEPTH=0, USE_YN=1): ${hierarchy.factories.length}`);
console.log(`Lines (DEPTH=1, USE_YN=1): ${hierarchy.lines.length}`);
console.log(`Processes (DEPTH=2, USE_YN=1): ${hierarchy.processes.length}`);
console.log(`Facilities (DEPTH=3, DATA_TYPE=G, USE_YN=1): ${hierarchy.facilities.length}`);
console.log(`Tags (DEPTH=4, DATA_TYPE=T, USE_YN=1): ${hierarchy.tags.length}`);

// Save to JSON
fs.writeFileSync('taglist_analysis.json', JSON.stringify(hierarchy, null, 2));
console.log('\n✅ Saved to taglist_analysis.json');

// Show samples
console.log('\n=== Sample Factories ===');
hierarchy.factories.forEach(f =>
  console.log(`  ${f.groupCode}: ${f.groupName}`)
);

console.log('\n=== Sample Lines ===');
hierarchy.lines.forEach(l =>
  console.log(`  ${l.groupCode}: ${l.groupName}`)
);

console.log('\n=== Sample Processes (first 20) ===');
hierarchy.processes.slice(0, 20).forEach(p =>
  console.log(`  ${p.groupCode}: ${p.groupName} (parent: ${p.pGroupCode})`)
);

console.log('\n=== Sample Facilities (first 20) ===');
hierarchy.facilities.slice(0, 20).forEach(f =>
  console.log(`  ${f.groupCode}: ${f.groupName} (parent: ${f.pGroupCode})`)
);

console.log('\n=== Sample Tags (first 20) ===');
hierarchy.tags.slice(0, 20).forEach(t =>
  console.log(`  ${t.tagName}: ${t.groupName} (parent: ${t.pGroupCode}, type: ${t.tagType})`)
);
