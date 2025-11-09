import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { DatabaseModule } from 'src/database/database.module';
import { EmployeeModule } from 'src/employee/employee.module';

@Module({
  imports: [DatabaseModule, EmployeeModule],
  providers: [ItemsService],
  controllers: [ItemsController],
})
export class ItemsModule {}
