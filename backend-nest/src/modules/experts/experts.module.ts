import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertProfile } from './entities/expert-profile.entity';
import { ExpertsService } from './experts.service';
import { ExpertsController } from './experts.controller';
import { User } from '../users/entities/user.entity';
import { ExpertVideo } from '../media/entities/expert-video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExpertProfile, User, ExpertVideo])],
  providers: [ExpertsService],
  controllers: [ExpertsController],
  exports: [ExpertsService],
})
export class ExpertsModule {}

