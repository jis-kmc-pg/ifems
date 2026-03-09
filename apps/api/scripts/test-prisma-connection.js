const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function test() {
  try {
    console.log('🔄 Testing Prisma connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL || 'not set, using default from .env');

    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Connection successful!');
    console.log('Current time:', result);

    const count = await prisma.tag.count();
    console.log('Tags count:', count);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
