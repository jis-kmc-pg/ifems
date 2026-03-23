const { Client } = require('pg');

async function run() {
  const c = new Client({
    host: 'localhost', port: 5432,
    user: 'postgres', password: '1',
    database: 'ifems',
    connectionTimeoutMillis: 10000,
    statement_timeout: 86400000, // 24시간
  });

  await c.connect();
  console.log('DB 연결 완료');

  const action = process.argv[2] || 'info';

  if (action === 'info') {
    // 청크 목록
    const r = await c.query(`
      SELECT chunk_schema, chunk_name,
             range_start::text as range_start, range_end::text as range_end,
             is_compressed,
             pg_size_pretty(pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass)) as size,
             pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass) as bytes
      FROM timescaledb_information.chunks
      WHERE hypertable_name='tag_data_raw'
      ORDER BY range_start
    `);
    console.log('\n=== tag_data_raw 청크 목록 ===');
    r.rows.forEach(row => {
      console.log(
        row.chunk_name.padEnd(25),
        row.size.padEnd(10),
        (row.is_compressed ? 'COMPRESSED' : 'RAW').padEnd(12),
        row.range_start, '~', row.range_end
      );
    });
    console.log('\n총', r.rows.length, '개 청크');

    // TimescaleDB 버전
    const ver = await c.query("SELECT default_version, installed_version FROM pg_available_extensions WHERE name='timescaledb'");
    console.log('TimescaleDB:', ver.rows[0]);

  } else if (action === 'enable') {
    // 1. 압축 설정 활성화
    console.log('\n=== 압축 설정 활성화 ===');
    await c.query(`
      ALTER TABLE tag_data_raw SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = '"tagId"',
        timescaledb.compress_orderby = 'timestamp DESC'
      )
    `);
    console.log('압축 설정 완료: segmentby=tagId, orderby=timestamp DESC');

  } else if (action === 'compress-oldest') {
    // 2. 가장 오래된 청크 1개만 압축
    const oldest = await c.query(`
      SELECT chunk_schema, chunk_name,
             range_start::text as range_start, range_end::text as range_end,
             pg_size_pretty(pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass)) as before_size,
             pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass) as before_bytes
      FROM timescaledb_information.chunks
      WHERE hypertable_name='tag_data_raw' AND NOT is_compressed
      ORDER BY range_start
      LIMIT 1
    `);
    if (oldest.rows.length === 0) {
      console.log('압축할 청크 없음');
    } else {
      const chunk = oldest.rows[0];
      console.log(`\n=== 시험 압축: ${chunk.chunk_name} ===`);
      console.log(`범위: ${chunk.range_start} ~ ${chunk.range_end}`);
      console.log(`압축 전: ${chunk.before_size}`);

      const start = Date.now();
      await c.query(`SELECT compress_chunk('${chunk.chunk_schema}.${chunk.chunk_name}')`);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      // 압축 후 크기
      const after = await c.query(`
        SELECT pg_size_pretty(pg_total_relation_size(format('%I.%I', '${chunk.chunk_schema}', '${chunk.chunk_name}')::regclass)) as after_size,
               pg_total_relation_size(format('%I.%I', '${chunk.chunk_schema}', '${chunk.chunk_name}')::regclass) as after_bytes
      `);
      const afterSize = after.rows[0].after_size;
      const ratio = (chunk.before_bytes / after.rows[0].after_bytes).toFixed(1);

      console.log(`압축 후: ${afterSize}`);
      console.log(`압축률: ${ratio}x`);
      console.log(`소요 시간: ${elapsed}초`);
    }

  } else if (action === 'compress-all-old') {
    // 3. 3일 이전 청크 모두 압축
    const chunks = await c.query(`
      SELECT chunk_schema, chunk_name,
             range_start::text as range_start, range_end::text as range_end,
             pg_size_pretty(pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass)) as size
      FROM timescaledb_information.chunks
      WHERE hypertable_name='tag_data_raw'
        AND NOT is_compressed
        AND range_end < NOW() - INTERVAL '3 days'
      ORDER BY range_start
    `);
    console.log(`\n=== 3일 이전 미압축 청크: ${chunks.rows.length}개 ===`);
    for (const chunk of chunks.rows) {
      console.log(`압축 중: ${chunk.chunk_name} (${chunk.size}) ${chunk.range_start} ~ ${chunk.range_end}`);
      try {
        const start = Date.now();
        await c.query(`SELECT compress_chunk('${chunk.chunk_schema}.${chunk.chunk_name}', if_not_compressed => true)`);
        console.log(`  완료 (${((Date.now() - start) / 1000).toFixed(1)}초)`);
      } catch (e) {
        console.log(`  스킵: ${e.message}`);
      }
    }
    console.log('모두 완료');

  } else if (action === 'compress-completed') {
    // 완료된 청크 모두 압축 (range_end < NOW(), 즉 오늘 청크 제외)
    const chunks = await c.query(`
      SELECT chunk_schema, chunk_name,
             range_start::text as range_start, range_end::text as range_end,
             pg_size_pretty(pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass)) as size
      FROM timescaledb_information.chunks
      WHERE hypertable_name='tag_data_raw'
        AND NOT is_compressed
        AND range_end < NOW()
      ORDER BY range_start
    `);
    console.log(`\n=== 완료된 미압축 청크: ${chunks.rows.length}개 ===`);
    for (const chunk of chunks.rows) {
      console.log(`압축 중: ${chunk.chunk_name} (${chunk.size}) ${chunk.range_start} ~ ${chunk.range_end}`);
      try {
        const start = Date.now();
        await c.query(`SELECT compress_chunk('${chunk.chunk_schema}.${chunk.chunk_name}', if_not_compressed => true)`);
        console.log(`  완료 (${((Date.now() - start) / 1000).toFixed(1)}초)`);
      } catch (e) {
        console.log(`  스킵: ${e.message}`);
      }
    }
    console.log('모두 완료');

  } else if (action === 'policy') {
    // 4. 자동 압축 정책 추가
    await c.query(`SELECT add_compression_policy('tag_data_raw', INTERVAL '3 days')`);
    console.log('자동 압축 정책 추가: 3일 이전 청크 자동 압축');

  } else if (action === 'status') {
    // 압축 통계
    const stats = await c.query(`SELECT * FROM chunk_compression_stats('tag_data_raw')`);
    console.log('\n=== 압축 통계 ===');
    stats.rows.forEach(row => console.log(row));

    // 전체 크기
    const total = await c.query("SELECT pg_size_pretty(hypertable_size('tag_data_raw')) as total");
    console.log('\ntag_data_raw 전체:', total.rows[0].total);
  }

  await c.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
