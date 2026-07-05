const { hash } = require('bcryptjs');
const postgres = require('postgres');

const DATABASE_URL = 'postgresql://postgres:DKLUwgvXvCMARsxmGVVzmqjoEWftRMXI@thomas.proxy.rlwy.net:21745/railway';

async function createTestUser() {
  const sql = postgres(DATABASE_URL);
  
  try {
    // Hash password
    const hashedPassword = await hash('admin123', 10);
    
    // Get or create toko first
    let toko = await sql`SELECT id FROM toko LIMIT 1`;
    if (toko.length === 0) {
      toko = await sql`
        INSERT INTO toko (nama, alamat, telepon, created_at)
        VALUES ('Toko Test', 'Test Address', '08123456789', NOW())
        RETURNING id
      `;
    }
    const tokoId = toko[0].id;
    
    // Insert test user (role: 'owner' or 'kasir')
    const result = await sql`
      INSERT INTO "user" (toko_id, email, password_hash, nama, role, aktif, created_at)
      VALUES (${tokoId}, 'admin@test.com', ${hashedPassword}, 'Admin Test', 'owner', true, NOW())
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = ${hashedPassword}, toko_id = ${tokoId}, aktif = true, role = 'owner'
      RETURNING id, email, nama, role
    `;
    
    console.log('✅ Test user created/updated:');
    console.log(result[0]);
    console.log('\nCredentials:');
    console.log('  Email: admin@test.com');
    console.log('  Password: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Check if users table exists
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      console.log('\n📋 Available tables:', tables.map(t => t.table_name).join(', '));
    } catch (e) {
      console.error('Could not list tables:', e.message);
    }
  } finally {
    await sql.end();
  }
}

createTestUser();
