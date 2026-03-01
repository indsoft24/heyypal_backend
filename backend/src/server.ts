import app from './app.js';
import { ensureDatabase } from './db/init.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await ensureDatabase();
  const host = process.env.HOST ?? '0.0.0.0';
  app.listen(Number(PORT), host, () => {
    console.log(`Server is running on http://${host}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
