import { Module } from '@nestjs/common';
import { GoalTypesController } from './goal-types.controller';
import { GoalTypesService } from './goal-types.service';

@Module({
  controllers: [GoalTypesController],
  providers: [GoalTypesService],
  exports: [GoalTypesService],
})
export class GoalTypesModule {}
