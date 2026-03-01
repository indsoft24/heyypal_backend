import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { InjectDataSource } from '@nestjs/typeorm';
import { Connection } from 'mongoose';
import { DataSource } from 'typeorm';
import { RedisService } from '../../core/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectConnection() private mongo: Connection,
    private redis: RedisService,
  ) {}

  @Get()
  async check() {
    const postgres = await this.dataSource.query('SELECT 1').then(() => 'ok').catch(() => 'down');
    const mongo = this.mongo.readyState === 1 ? 'ok' : 'down';
    let redis = 'down';
    try {
      await this.redis.getClient().ping();
      redis = 'ok';
    } catch {}
    return {
      status: postgres === 'ok' && mongo === 'ok' ? 'ok' : 'degraded',
      postgres,
      mongo,
      redis,
    };
  }
}
