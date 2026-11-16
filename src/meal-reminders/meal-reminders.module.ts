import { Module } from '@nestjs/common';
import { MealRemindersController } from './meal-reminders.controller';
import { MealRemindersService } from './meal-reminders.service';

@Module({
  controllers: [MealRemindersController],
  providers: [MealRemindersService],
})
export class MealRemindersModule {}
