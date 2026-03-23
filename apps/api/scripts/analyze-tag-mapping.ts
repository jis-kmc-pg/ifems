import { Client } from 'pg';

const c = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '1',
  database: 'ifems',
});

async function main() {
  await c.connect();

  // 1. CYCLE의 TAG_NAME 분포
  const tagNames = await c.query(`
    SELECT "TAG_NAME", COUNT(DISTINCT "MACH_ID") as mach_count, COUNT(*) as cycle_count
    FROM "CYCLE_STD_MST_MMS"
    GROUP BY "TAG_NAME"
    ORDER BY cycle_count DESC
    LIMIT 30
  `);
  console.log('=== CYCLE TAG_NAME 분포 TOP 30 ===');
  for (const r of tagNames.rows) {
    console.log(`  ${r.TAG_NAME}: ${r.mach_count}대 설비, ${r.cycle_count}건`);
  }

  // 2. 설비별 태그 조합
  const machTagCombo = await c.query(`
    SELECT "MACH_ID",
      array_agg(DISTINCT "TAG_NAME" ORDER BY "TAG_NAME") as tags,
      COUNT(*) as cycles
    FROM "CYCLE_STD_MST_MMS"
    GROUP BY "MACH_ID"
    ORDER BY "MACH_ID"
    LIMIT 20
  `);
  console.log('\n=== 설비별 태그 조합 (처음 20대) ===');
  for (const r of machTagCombo.rows) {
    console.log(`  MACH=${r.MACH_ID} [${r.tags.join(', ')}] ${r.cycles}건`);
  }

  // 3. i-FEMS tags 테이블에서 INSTANTANEOUS 태그 목록
  const instTags = await c.query(`
    SELECT "tagName", "measureType", "energyType", category, "facilityId"
    FROM tags
    WHERE "measureType" = 'INSTANTANEOUS' AND "isActive" = true
    ORDER BY "tagName"
    LIMIT 30
  `);
  console.log('\n=== i-FEMS INSTANTANEOUS 태그 샘플 ===');
  for (const r of instTags.rows) {
    console.log(`  ${r.tagName} (${r.energyType}/${r.category}) fac=${r.facilityId}`);
  }

  // 4. CYCLE TAG_NAME과 i-FEMS tagName 패턴 비교
  const cycleTags = await c.query(`SELECT DISTINCT "TAG_NAME" FROM "CYCLE_STD_MST_MMS" LIMIT 5`);
  console.log('\n=== TAG_NAME 매칭 시도 ===');
  for (const ct of cycleTags.rows) {
    const match = await c.query(
      `SELECT "tagName", "measureType", "energyType" FROM tags WHERE "tagName" LIKE $1 LIMIT 3`,
      [`%${ct.TAG_NAME}%`],
    );
    console.log(`  CYCLE: ${ct.TAG_NAME}`);
    if (match.rows.length > 0) {
      for (const m of match.rows) {
        console.log(`    → ${m.tagName} (${m.measureType}/${m.energyType})`);
      }
    } else {
      console.log('    → NO MATCH');
    }
  }

  // 5. TAG_NAME 네이밍 패턴 분석
  const patterns = await c.query(`
    SELECT
      CASE
        WHEN "TAG_NAME" LIKE '%_FL%' THEN 'FL (유량?)'
        WHEN "TAG_NAME" LIKE '%_KW%' THEN 'KW (전력?)'
        WHEN "TAG_NAME" LIKE '%_AMS%' THEN 'AMS (전류?)'
        WHEN "TAG_NAME" LIKE '%_GL%' THEN 'GL (글로벌?)'
        ELSE 'OTHER'
      END as pattern,
      COUNT(*) as cnt,
      COUNT(DISTINCT "TAG_NAME") as tag_variants
    FROM "CYCLE_STD_MST_MMS"
    GROUP BY 1
    ORDER BY cnt DESC
  `);
  console.log('\n=== TAG_NAME 네이밍 패턴 ===');
  for (const r of patterns.rows) {
    console.log(`  ${r.pattern}: ${r.cnt}건 (${r.tag_variants}종)`);
  }

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
