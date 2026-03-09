import pg from 'pg';

async function checkObjects() {
  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'ifems',
    user: 'postgres',
    password: '1',
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        schemaname, 
        viewname as name, 
        'view' as type
      FROM pg_views 
      WHERE viewname LIKE 'cagg%'
      UNION ALL
      SELECT 
        schemaname, 
        matviewname as name, 
        'materialized_view' as type
      FROM pg_matviews 
      WHERE matviewname LIKE 'cagg%'
      UNION ALL
      SELECT 
        schemaname,
        tablename as name,
        'table' as type
      FROM pg_tables
      WHERE tablename LIKE 'cagg%'
      ORDER BY name
    `);
    
    console.log('Existing objects:');
    console.table(result.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkObjects();
