import pg from 'pg';

async function checkPolicies() {
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
        view_name,
        schedule_interval,
        config
      FROM timescaledb_information.jobs
      WHERE application_name LIKE '%cagg%'
      OR view_name LIKE '%cagg%'
    `);
    
    console.log('Existing policies:');
    console.table(result.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkPolicies();
