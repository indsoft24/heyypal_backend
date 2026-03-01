/**
 * Seed first admin user. Run after PostgreSQL schema is applied.
 * Usage: npx tsx scripts/seed-admin.ts
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? 'heyypal',
  password: process.env.PG_PASSWORD ?? 'heyypal',
  database: process.env.PG_DATABASE ?? 'heyypal',
});

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@heyypal.com';
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'Admin123!';
  const name = process.env.ADMIN_SEED_NAME ?? 'Admin';

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO admin_users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [name, email, hash]
  );
  console.log('Admin user ready:', email);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
