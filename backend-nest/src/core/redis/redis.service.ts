import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private config: ConfigService) {
    this.client = new Redis(this.config.get<string>('REDIS_URI') || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T = string>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    if (v == null) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return v as T;
    }
  }

  async set(key: string, value: string | object, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) await this.client.setex(key, ttlSeconds, serialized);
    else await this.client.set(key, serialized);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
