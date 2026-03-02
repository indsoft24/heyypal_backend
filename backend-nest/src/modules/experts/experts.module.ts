import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertProfile } from './entities/expert-profile.entity';
import { ExpertsService } from './experts.service';
import { ExpertsController } from './experts.controller';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExpertProfile, User])],
  providers: [ExpertsService],
  controllers: [ExpertsController],
  exports: [ExpertsService],
})
export class ExpertsModule {}

