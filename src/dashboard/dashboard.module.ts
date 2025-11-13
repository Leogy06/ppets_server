import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from 'src/database/database.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
