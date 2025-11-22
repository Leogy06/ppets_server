import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeeModule } from './employee/employee.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { DepartmentModule } from './department/department.module';
import { ItemsModule } from './items/items.module';
import { AccountCodesModule } from './account_codes/account_codes.module';
import { TransactionModule } from './transaction/transaction.module';
import { NotificationModule } from './notification/notification.module';
import { AccountRequestsModule } from './account_requests/account_requests.module';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './auth/guards/roles.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardModule } from './dashboard/dashboard.module';
import { DummyModule } from './dummy/dummy.module';
import { TransactionConcernModule } from './transaction_concern/transaction_concern.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EmployeeModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    DepartmentModule,
    ItemsModule,
    AccountCodesModule,
    TransactionModule,
    NotificationModule,
    AccountRequestsModule,
    DashboardModule,
    DummyModule,
    TransactionConcernModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule {}
