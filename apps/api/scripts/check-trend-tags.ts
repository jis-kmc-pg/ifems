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

  // 1. 전체 트렌드 태그 수
  const total = await c.query(`
    SELECT COUNT(*) as cnt
    FROM tags
    WHERE "measureType" = 'INSTANTANEOUS' AND category = 'ENERGY' AND "isActive" = true
  `);
  console.log(`=== 트렌드 태그 총: ${total.rows[0].cnt}개 ===`);

  // 2. 설비별 트렌드 태그 수
  const perFac = await c.query(`
    SELECT f.code, COUNT(*) as tag_count,
      array_agg(t."tagName" ORDER BY t."tagName") as tags
    FROM tags t
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."measureType" = 'INSTANTANEOUS' AND t.category = 'ENERGY' AND t."isActive" = true
    GROUP BY f.code
    ORDER BY tag_count DESC
    LIMIT 20
  `);
  console.log('\n=== 설비별 트렌드 태그 수 TOP 20 ===');
  for (const r of perFac.rows) {
    console.log(`  ${r.code}: ${r.tag_count}개 [${r.tags.join(', ')}]`);
  }

  // 3. 태그 수 분포
  const dist = await c.query(`
    SELECT tag_count, COUNT(*) as fac_count
    FROM (
      SELECT "facilityId", COUNT(*) as tag_count
      FROM tags
      WHERE "measureType" = 'INSTANTANEOUS' AND category = 'ENERGY' AND "isActive" = true
      GROUP BY "facilityId"
    ) sub
    GROUP BY tag_count
    ORDER BY tag_count
  `);
  console.log('\n=== 트렌드 태그 수 분포 ===');
  for (const r of dist.rows) {
    console.log(`  ${r.tag_count}개 태그: ${r.fac_count}개 설비`);
  }

  // 4. 전체 설비 수
  const facCount = await c.query(`
    SELECT COUNT(DISTINCT "facilityId") as cnt
    FROM tags
    WHERE "measureType" = 'INSTANTANEOUS' AND category = 'ENERGY' AND "isActive" = true
  `);
  console.log(`\n총 설비 수: ${facCount.rows[0].cnt}개`);

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
