const { Pool } = require('pg');

// Try with new password
const pool = new Pool({
  connectionString: 'postgresql://postgres:test123@127.0.0.1:5432/ifems',
  ssl: false,
});

async function test() {
  try {
    console.log('🔄 Testing PostgreSQL connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connection successful!');
    console.log('Current time:', result.rows[0]);

    const countResult = await pool.query('SELECT COUNT(*) FROM tags');
    console.log('Tags count:', countResult.rows[0].count);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await pool.end();
  }
}

test();
