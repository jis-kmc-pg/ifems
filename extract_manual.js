const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];

// Raw 데이터로 읽기
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log(`총 행 수: ${rawData.length}\n`);

// 헤더 찾기
const headerRow = rawData.find(row => row.includes('PLANT_CODE'));
const headerIndex = rawData.indexOf(headerRow);

console.log(`헤더 행 인덱스: ${headerIndex}`);
console.log(`헤더:`, headerRow.slice(0, 13).join(' | '));
console.log('');

// 헤더 매핑
const headers = headerRow;
const plantCodeIdx = headers.indexOf('PLANT_CODE');
const pGroupCodeIdx = headers.indexOf('P_GROUP_CODE');
const groupCodeIdx = headers.indexOf('GROUP_CODE');
const groupNameIdx = headers.indexOf('GROUP_NAME');
const depthIdx = headers.indexOf('DEPTH');
const useYnIdx = headers.indexOf('USE_YN');
const dataTypeIdx = headers.indexOf('DATA_TYPE');

console.log(`컬럼 인덱스: PLANT_CODE=${plantCodeIdx}, P_GROUP_CODE=${pGroupCodeIdx}, GROUP_CODE=${groupCodeIdx}, DEPTH=${depthIdx}, USE_YN=${useYnIdx}, DATA_TYPE=${dataTypeIdx}\n`);

// 데이터 파싱
const stats = {};
const facilities = {};

for (let i = headerIndex + 1; i < rawData.length; i++) {
  const row = rawData[i];

  const depth = row[depthIdx];
  const dataType = row[dataTypeIdx];
  const useYn = row[useYnIdx];
  const pGroupCode = row[pGroupCodeIdx];
  const groupCode = row[groupCodeIdx];
  const groupName = row[groupNameIdx];

  // 필터링: DEPTH=2, DATA_TYPE=G, USE_YN=1
  if (depth === 2 && dataType === 'G' && useYn === 1) {
    const line = pGroupCode;
    if (!line || !['BLOCK', 'HEAD', 'CRANK', 'ASSEMBLE'].includes(line)) continue;

    if (!stats[line]) stats[line] = 0;
    stats[line]++;

    if (!facilities[line]) facilities[line] = [];

    const code = groupCode;
    const name = groupName || code;
    const id = code.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const lineLabel = {
      'BLOCK': '블록',
      'HEAD': '헤드',
      'CRANK': '크랭크',
      'ASSEMBLE': '조립'
    }[line];

    facilities[line].push({
      id,
      code,
      name,
      line: line.toLowerCase(),
      lineLabel,
      process: 'OP0',
      type: 'MC',
      status: 'NORMAL',
      isProcessing: true
    });
  }
}

console.log('=== 라인별 설비 그룹 개수 (DEPTH=2, DATA_TYPE=G, USE_YN=1) ===');
Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([line, count]) => {
  console.log(`${line.padEnd(15)} : ${count}개`);
});

const totalCount = Object.values(stats).reduce((a, b) => a + b, 0);
console.log(`\n총 설비 그룹: ${totalCount}개\n`);

if (totalCount > 0) {
  // TypeScript 형식으로 출력
  const output = [];
  output.push('// ============================================================');
  output.push('// i-FEMS 전체 라인 설비 데이터 - 화성PT4공장_TagList.xlsx');
  output.push(`// 총 ${totalCount}개 설비`);
  output.push('// ============================================================\n');

  ['BLOCK', 'HEAD', 'CRANK', 'ASSEMBLE'].forEach(line => {
    if (facilities[line] && facilities[line].length > 0) {
      const lineLabel = {
        'BLOCK': '블록',
        'HEAD': '헤드',
        'CRANK': '크랭크',
        'ASSEMBLE': '조립'
      }[line];

      output.push(`// ──────────────────────────────────────────────`);
      output.push(`// ${lineLabel} 라인 설비 (${facilities[line].length}개)`);
      output.push(`// ──────────────────────────────────────────────`);
      output.push(`export const ${line}_FACILITIES: Facility[] = [`);

      facilities[line].forEach((f, i) => {
        const comma = i < facilities[line].length - 1 ? ',' : '';
        output.push(`  ${JSON.stringify(f)}${comma}`);
      });

      output.push('];\n');
    }
  });

  // 전체 설비 통합 배열
  output.push('// ──────────────────────────────────────────────');
  output.push('// 전체 설비 통합');
  output.push('// ──────────────────────────────────────────────');
  output.push('export const ALL_FACILITIES: Facility[] = [');
  ['BLOCK', 'HEAD', 'CRANK', 'ASSEMBLE'].forEach(line => {
    if (facilities[line] && facilities[line].length > 0) {
      output.push(`  ...${line}_FACILITIES,`);
    }
  });
  output.push('];');

  fs.writeFileSync('temp_all_facilities.ts', output.join('\n'));
  console.log('✅ TypeScript 코드를 temp_all_facilities.ts에 저장했습니다.');
} else {
  console.log('⚠️  추출된 데이터가 없습니다.');
}
