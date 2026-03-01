/**
 * Seed first admin user. Run after schema is applied.
 * Usage: npx tsx scripts/seed-admin.ts
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
async function main() {
    const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@heyypal.com';
    const password = process.env.ADMIN_SEED_PASSWORD ?? 'Admin123!';
    const name = process.env.ADMIN_SEED_NAME ?? 'Admin';
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST ?? 'localhost',
        port: Number(process.env.MYSQL_PORT ?? 3306),
        user: process.env.MYSQL_USER ?? 'root',
        password: process.env.MYSQL_PASSWORD ?? '',
        database: process.env.MYSQL_DATABASE ?? 'heyypal',
    });
    const hash = await bcrypt.hash(password, 12);
    await pool.execute('INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)', [name, email, hash, 'admin']);
    console.log('Admin user ready:', email);
    await pool.end();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=seed-admin.js.map