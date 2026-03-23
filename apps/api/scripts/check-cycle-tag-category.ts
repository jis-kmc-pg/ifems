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

  // 1. CYCLE TAG_NAME별 i-FEMS 태그 카테고리 매핑
  const mapping = await c.query(`
    SELECT DISTINCT c."TAG_NAME" as cycle_tag,
      t."tagName", t."measureType", t."energyType", t.category,
      t."displayName"
    FROM "CYCLE_STD_MST_MMS" c
    JOIN tags t ON t."tagName" = c."TAG_NAME"
    ORDER BY t.category, c."TAG_NAME"
  `);
  console.log('=== CYCLE TAG_NAME → i-FEMS 태그 카테고리 매핑 ===');
  const byCategory: Record<string, any[]> = {};
  for (const r of mapping.rows) {
    const key = `${r.category}/${r.energyType}`;
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(r);
  }
  for (const [cat, rows] of Object.entries(byCategory)) {
    console.log(`\n  [${cat}] ${rows.length}개 태그:`);
    for (const r of rows.slice(0, 10)) {
      console.log(`    ${r.cycle_tag} → ${r.measureType} | ${r.displayName || ''}`);
    }
    if (rows.length > 10) console.log(`    ... +${rows.length - 10}개`);
  }

  // 2. 패턴별 분류 (KW/FL/AMS/GL)
  console.log('\n=== 패턴별 카테고리 분포 ===');
  const patternCat = await c.query(`
    SELECT
      CASE
        WHEN c."TAG_NAME" LIKE '%_KW%' THEN 'KW'
        WHEN c."TAG_NAME" LIKE '%_FL%' THEN 'FL'
        WHEN c."TAG_NAME" LIKE '%_AMS%' THEN 'AMS'
        WHEN c."TAG_NAME" LIKE '%_GL_%' THEN 'GL'
        ELSE 'OTHER'
      END as pattern,
      t.category, t."energyType",
      COUNT(DISTINCT c."TAG_NAME") as tag_count,
      COUNT(*) as cycle_count
    FROM "CYCLE_STD_MST_MMS" c
    JOIN tags t ON t."tagName" = c."TAG_NAME"
    GROUP BY 1, t.category, t."energyType"
    ORDER BY 1, 2
  `);
  for (const r of patternCat.rows) {
    console.log(`  ${r.pattern} → ${r.category}/${r.energyType}: ${r.tag_count}종 태그, ${r.cycle_count}건 싸이클`);
  }

  // 3. 매칭되지 않는 CYCLE TAG_NAME
  const unmatched = await c.query(`
    SELECT DISTINCT c."TAG_NAME"
    FROM "CYCLE_STD_MST_MMS" c
    LEFT JOIN tags t ON t."tagName" = c."TAG_NAME"
    WHERE t.id IS NULL
    LIMIT 20
  `);
  console.log(`\n=== i-FEMS에 없는 CYCLE TAG_NAME (${unmatched.rows.length}개) ===`);
  for (const r of unmatched.rows) {
    console.log(`  ${r.TAG_NAME}`);
  }

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
