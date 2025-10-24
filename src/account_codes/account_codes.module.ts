import { Module } from '@nestjs/common';
import { AccountCodesService } from './account_codes.service';
import { AccountCodesController } from './account_codes.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AccountCodesService],
  controllers: [AccountCodesController],
})
export class AccountCodesModule {}
