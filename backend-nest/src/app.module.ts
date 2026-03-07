import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { ExpertsModule } from './modules/experts/experts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CallModule } from './modules/call/call.module';
import { UploadModule } from './modules/upload/upload.module';
import { MediaModule } from './modules/media/media.module';
import { AgoraModule } from './modules/agora/agora.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsService } from './modules/notifications/notifications.service';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      username: process.env.POSTGRES_USER || 'heyypal',
      password: process.env.POSTGRES_PASSWORD || 'heyypal',
      database: process.env.POSTGRES_DB || 'heyypal',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI') || 'mongodb://localhost:27017/heyypal',
        dbName: 'heyypal',
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      }),
    }),
    CoreModule,
    AuthModule,
    UsersModule,
    // HealthModule,
    AdminModule,
    CallModule,
    ExpertsModule,
    CategoriesModule,
    UploadModule,
    MediaModule,
    AgoraModule,
    ChatModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, NotificationsService],
})
export class AppModule { }
