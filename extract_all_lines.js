const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

// 라인별 설비 그룹 통계
const stats = {};
const facilities = { BLOCK: [], HEAD: [], CRANK: [], ASSEMBLE: [] };

data.forEach(row => {
  if (row.DEPTH === 2 && row.DATA_TYPE === 'G' && row.USE_YN === 1) {
    const line = row.P_GROUP_CODE;
    if (!stats[line]) stats[line] = 0;
    stats[line]++;

    // 설비 데이터 수집
    const code = row.GROUP_CODE;
    const name = row.GROUP_NAME || code;
    const id = code.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const facility = {
      id,
      code,
      name,
      line: line.toLowerCase(),
      lineLabel: line === 'BLOCK' ? '블록' : line === 'HEAD' ? '헤드' : line === 'CRANK' ? '크랭크' : '조립',
      process: 'OP0', // 기본값, 실제로는 하위 태그 분석 필요
      type: 'MC',
      status: 'NORMAL',
      isProcessing: true
    };

    if (facilities[line]) {
      facilities[line].push(facility);
    }
  }
});

console.log('=== 라인별 설비 그룹 개수 (DEPTH=2, DATA_TYPE=G, USE_YN=1) ===');
Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([line, count]) => {
  console.log(`${line.padEnd(15)} : ${count}개`);
});
console.log(`\n총 설비 그룹: ${Object.values(stats).reduce((a, b) => a + b, 0)}개\n`);

// TypeScript 형식으로 출력
const output = [];
output.push('// ============================================================');
output.push('// i-FEMS 전체 라인 설비 데이터 - 화성PT4공장_TagList.xlsx');
output.push('// ============================================================\n');

['BLOCK', 'HEAD', 'CRANK', 'ASSEMBLE'].forEach(line => {
  if (facilities[line].length > 0) {
    const lineLabel = line === 'BLOCK' ? '블록' : line === 'HEAD' ? '헤드' : line === 'CRANK' ? '크랭크' : '조립';
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

fs.writeFileSync('temp_all_facilities.ts', output.join('\n'));
console.log('✅ TypeScript 코드를 temp_all_facilities.ts에 저장했습니다.');
