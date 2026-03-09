const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('Tag/화성PT4공장_TagList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];

// 행 8 (인덱스 7)이 헤더이므로, 행 9 (인덱스 8)부터 데이터 시작
// range 옵션을 사용하여 헤더 행을 지정
const data = XLSX.utils.sheet_to_json(ws, { range: "A8" });

console.log(`총 데이터 행 수: ${data.length}\n`);

// 샘플 확인
console.log('=== 첫 5개 행 샘플 ===');
data.slice(0, 5).forEach((row, i) => {
  console.log(`Row ${i}: ${row.P_GROUP_CODE} / ${row.GROUP_CODE} / DEPTH=${row.DEPTH} / DATA_TYPE=${row.DATA_TYPE} / USE_YN=${row.USE_YN}`);
});
console.log('');

// 라인별 설비 그룹 통계 및 수집
const stats = {};
const facilities = {};

data.forEach(row => {
  // DEPTH=2 (설비 그룹), DATA_TYPE=G (그룹), USE_YN=1 (사용)
  if (row.DEPTH === 2 && row.DATA_TYPE === 'G' && row.USE_YN === 1) {
    const line = row.P_GROUP_CODE;
    if (!line || !['BLOCK', 'HEAD', 'CRANK', 'ASSEMBLE'].includes(line)) return;

    if (!stats[line]) stats[line] = 0;
    stats[line]++;

    if (!facilities[line]) facilities[line] = [];

    const code = row.GROUP_CODE;
    const name = row.GROUP_NAME || code;
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
      process: 'OP0', // 기본값
      type: 'MC',
      status: 'NORMAL',
      isProcessing: true
    });
  }
});

console.log('=== 라인별 설비 그룹 개수 (DEPTH=2, DATA_TYPE=G, USE_YN=1) ===');
Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([line, count]) => {
  console.log(`${line.padEnd(15)} : ${count}개`);
});

const totalCount = Object.values(stats).reduce((a, b) => a + b, 0);
console.log(`\n총 설비 그룹: ${totalCount}개\n`);

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

fs.writeFileSync('temp_all_facilities.ts', output.join('\n'));
console.log('✅ TypeScript 코드를 temp_all_facilities.ts에 저장했습니다.');

// 전체 설비 통합 배열도 생성
output.push('// 전체 설비 통합');
output.push('export const ALL_FACILITIES: Facility[] = [');
['BLOCK', 'HEAD', 'CRANK', 'ASSEMBLE'].forEach(line => {
  if (facilities[line] && facilities[line].length > 0) {
    output.push(`  ...${line}_FACILITIES,`);
  }
});
output.push('];');

fs.writeFileSync('temp_all_facilities.ts', output.join('\n'));
console.log('✅ 전체 설비 데이터 생성 완료!');
