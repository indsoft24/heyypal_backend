import pg from 'pg';
import { MongoClient, type Db } from 'mongodb';

const { Pool } = pg;

export const pgPool = new Pool({
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? 'heyypal',
  password: process.env.PG_PASSWORD ?? 'heyypal',
  database: process.env.PG_DATABASE ?? 'heyypal',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/** Default export for drop-in replacement: use pgPool.query() like pool.query() */
export default pgPool;

const mongoUri =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const mongoDbName = process.env.MONGODB_DB ?? 'heyypal';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (mongoDb) return mongoDb;
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(mongoDbName);
  return mongoDb;
}

export async function closeMongo(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
}
