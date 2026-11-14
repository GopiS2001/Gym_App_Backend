import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GoalsModule } from './goals/goals.module';
import { GoalTypesModule } from './goal-types/goal-types.module';
import { CategoriesModule } from './categories/categories.module';
import { ExercisesModule } from './exercises/exercises.module';
import { WorkoutPlansModule } from './workout-plans/workout-plans.module';
import { WorkoutSessionsModule } from './workout-sessions/workout-sessions.module';
import { ProgressModule } from './progress/progress.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { WaterModule } from './water/water.module';
import { SleepModule } from './sleep/sleep.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MediaModule } from './media/media.module';
import { SettingsModule } from './settings/settings.module';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Uploaded images and videos are served straight from disk by Express
    // static middleware registered in main.ts. ServeStaticModule is not used
    // here because its SPA fallback turns a missing file into a request for
    // index.html, which this API does not have.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),

    PrismaModule,
    AuthModule,
    UsersModule,
    GoalsModule,
    GoalTypesModule,
    CategoriesModule,
    ExercisesModule,
    WorkoutPlansModule,
    WorkoutSessionsModule,
    ProgressModule,
    NutritionModule,
    WaterModule,
    SleepModule,
    AttendanceModule,
    AnalyticsModule,
    MediaModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
