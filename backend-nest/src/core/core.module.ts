import { Global, Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { EncryptionModule } from './encryption/encryption.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { LoggingModule } from './logging/logging.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';

@Global()
@Module({
  imports: [
    RedisModule,
    EncryptionModule,
    RabbitMQModule,
    LoggingModule,
    AuditModule,
    StorageModule,
  ],
  exports: [
    RedisModule,
    EncryptionModule,
    RabbitMQModule,
    LoggingModule,
    AuditModule,
    StorageModule,
  ],
})
export class CoreModule {}
