import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // UTC 기반 시뮬레이션
  console.log('=== UTC 기반 에어 감지 시뮬레이션 ===\n');

  // 먼저 hourly CTE 확인
  console.log('--- hourly CTE (UTC 기반) ---');
  const hourly = await prisma.$queryRawUnsafe<any[]>(`
    WITH utc_now AS (SELECT NOW() AT TIME ZONE 'UTC' AS t)
    SELECT f.code, SUM(cu.last_value - cu.first_value) AS current_usage, COUNT(*) as tags
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    CROSS JOIN utc_now u
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket >= date_trunc('hour', u.t) - INTERVAL '1 hour'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY f.code
    ORDER BY current_usage DESC
    LIMIT 10;
  `);
  console.log('  설비수: ' + hourly.length);
  for (const h of hourly) {
    console.log('  ' + h.code + ': ' + Number(h.current_usage).toFixed(1) + 'L (tags=' + h.tags + ')');
  }

  // daily_avg 확인
  console.log('\n--- daily_avg (UTC 기반) ---');
  const daily = await prisma.$queryRawUnsafe<any[]>(`
    WITH utc_now AS (SELECT NOW() AT TIME ZONE 'UTC' AS t)
    SELECT f.code,
      SUM(cu.last_value - cu.first_value) / GREATEST(COUNT(DISTINCT cu.bucket), 1) AS avg_hourly,
      COUNT(DISTINCT cu.bucket) as buckets
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    CROSS JOIN utc_now u
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket >= u.t - INTERVAL '25 hours'
      AND cu.bucket < date_trunc('hour', u.t) - INTERVAL '1 hour'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY f.code
    ORDER BY avg_hourly DESC
    LIMIT 10;
  `);
  for (const d of daily) {
    console.log('  ' + d.code + ': avg=' + Number(d.avg_hourly).toFixed(1) + 'L/h (buckets=' + d.buckets + ')');
  }

  // 전체 비교 (minBaseline=0, 전 설비)
  console.log('\n--- 전체 비교 (minBaseline=0) ---');
  const all = await prisma.$queryRawUnsafe<any[]>(`
    WITH utc_now AS (SELECT NOW() AT TIME ZONE 'UTC' AS t),
    hourly AS (
      SELECT cu."facilityId", SUM(cu.last_value - cu.first_value) AS current_usage
      FROM cagg_usage_1h cu
      JOIN tags t ON cu."tagId" = t.id
      CROSS JOIN utc_now u
      WHERE t."energyType" = 'air' AND t."isActive" = true
        AND cu.bucket >= date_trunc('hour', u.t) - INTERVAL '1 hour'
        AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
      GROUP BY cu."facilityId"
    ),
    daily_avg AS (
      SELECT cu."facilityId",
        SUM(cu.last_value - cu.first_value) / GREATEST(COUNT(DISTINCT cu.bucket), 1) AS avg_hourly
      FROM cagg_usage_1h cu
      JOIN tags t ON cu."tagId" = t.id
      CROSS JOIN utc_now u
      WHERE t."energyType" = 'air' AND t."isActive" = true
        AND cu.bucket >= u.t - INTERVAL '25 hours'
        AND cu.bucket < date_trunc('hour', u.t) - INTERVAL '1 hour'
        AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
      GROUP BY cu."facilityId"
    )
    SELECT f.code, h.current_usage, d.avg_hourly,
      h.current_usage / d.avg_hourly * 100 AS usage_ratio
    FROM hourly h
    JOIN daily_avg d ON h."facilityId" = d."facilityId"
    JOIN facilities f ON h."facilityId" = f.id
    ORDER BY usage_ratio DESC
    LIMIT 20;
  `);
  console.log('  비교 가능한 설비: ' + all.length);
  for (const a of all.slice(0, 10)) {
    console.log('  ' + a.code + ': cur=' + Number(a.current_usage).toFixed(1) + ' avg=' + Number(a.avg_hourly).toFixed(1) + ' ratio=' + Number(a.usage_ratio).toFixed(0) + '%');
  }

  // 감지 시뮬레이션
  console.log('\n=== 감지 시뮬레이션 (minBaseline별 x surgePct별) ===');
  for (const minBaseline of [0, 30, 50, 100]) {
    console.log('\n--- minBaseline=' + minBaseline + ' ---');
    for (const surgePct of [5, 10, 15, 20, 30, 50]) {
      const surgeRatio = 1 + surgePct / 100;
      const detected = await prisma.$queryRawUnsafe<any[]>(`
        WITH utc_now AS (SELECT NOW() AT TIME ZONE 'UTC' AS t),
        hourly AS (
          SELECT cu."facilityId", f.code as fac_code,
            SUM(cu.last_value - cu.first_value) AS current_usage
          FROM cagg_usage_1h cu
          JOIN tags t ON cu."tagId" = t.id
          JOIN facilities f ON t."facilityId" = f.id
          CROSS JOIN utc_now u
          WHERE t."energyType" = 'air' AND t."isActive" = true
            AND cu.bucket >= date_trunc('hour', u.t) - INTERVAL '1 hour'
            AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
          GROUP BY cu."facilityId", f.code
        ),
        daily_avg AS (
          SELECT cu."facilityId",
            SUM(cu.last_value - cu.first_value) / GREATEST(COUNT(DISTINCT cu.bucket), 1) AS avg_hourly
          FROM cagg_usage_1h cu
          JOIN tags t ON cu."tagId" = t.id
          CROSS JOIN utc_now u
          WHERE t."energyType" = 'air' AND t."isActive" = true
            AND cu.bucket >= u.t - INTERVAL '25 hours'
            AND cu.bucket < date_trunc('hour', u.t) - INTERVAL '1 hour'
            AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
          GROUP BY cu."facilityId"
        )
        SELECT h.fac_code, h.current_usage, d.avg_hourly,
          h.current_usage / d.avg_hourly * 100 AS usage_ratio
        FROM hourly h
        JOIN daily_avg d ON h."facilityId" = d."facilityId"
        WHERE d.avg_hourly > ${minBaseline}
          AND h.current_usage / d.avg_hourly > ${surgeRatio}
        ORDER BY usage_ratio DESC;
      `);
      let line = '  surge=' + surgePct + '%: ' + detected.length + '개 설비';
      if (detected.length > 0 && detected.length <= 5) {
        const ex = detected.map(d => d.fac_code + '(' + Number(d.usage_ratio).toFixed(0) + '%)').join(', ');
        line += ' [' + ex + ']';
      } else if (detected.length > 5) {
        const ex = detected.slice(0, 3).map(d => d.fac_code + '(' + Number(d.usage_ratio).toFixed(0) + '%)').join(', ');
        line += ' [' + ex + ' ...]';
      }
      console.log(line);
    }
  }

  // 전력 품질 - UTC 기반으로 재확인
  console.log('\n=== 전력 품질: UTC 기반 재확인 ===');
  const qualCheck = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as cnt, MAX(d.timestamp)::text as latest_text
    FROM tag_data_raw d
    JOIN tags t ON d."tagId" = t.id
    WHERE t.category = 'QUALITY' AND t."isActive" = true
      AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
  `);
  console.log('  QUALITY (UTC-5min): ' + qualCheck[0].cnt + '건, latest=' + qualCheck[0].latest_text);

  // tag_data_raw의 timestamp 타입과 최근 QUALITY 값
  const rawType = await prisma.$queryRawUnsafe<any[]>(`
    SELECT pg_typeof(timestamp)::text as ts_type FROM tag_data_raw LIMIT 1;
  `);
  console.log('  tag_data_raw.timestamp type: ' + (rawType[0]?.ts_type || 'N/A'));

  const qualRecent = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as cnt, MAX(d.timestamp)::text as latest_text
    FROM tag_data_raw d
    JOIN tags t ON d."tagId" = t.id
    WHERE t.category = 'QUALITY' AND t."isActive" = true
      AND d.timestamp >= NOW() - INTERVAL '5 minutes'
  `);
  console.log('  QUALITY (NOW()-5min, timestamptz): ' + qualRecent[0].cnt + '건, latest=' + qualRecent[0].latest_text);
}

main().catch(console.error).finally(() => prisma.$disconnect());
