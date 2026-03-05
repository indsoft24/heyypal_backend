import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { User } from '../users/entities/user.entity';
import { ExpertVideo } from './entities/expert-video.entity';
import { ExpertProfile } from '../experts/entities/expert-profile.entity';
import { ProfilePhotoService } from './profile-photo.service';
import { ExpertVideoService } from './expert-video.service';
import { MediaController } from './media.controller';
import { ExpertVideoController } from './expert-video.controller';

@Module({
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([User, ExpertVideo, ExpertProfile]),
  ],
  controllers: [MediaController, ExpertVideoController],
  providers: [ProfilePhotoService, ExpertVideoService],
  exports: [ProfilePhotoService, ExpertVideoService],
})
export class MediaModule {}
