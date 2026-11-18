import { Module } from '@nestjs/common';
import { WarmupsController } from './warmups.controller';
import { WarmupsService } from './warmups.service';

@Module({
  controllers: [WarmupsController],
  providers: [WarmupsService],
})
export class WarmupsModule {}
