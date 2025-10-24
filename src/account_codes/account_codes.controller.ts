import { Controller, Get } from '@nestjs/common';
import { AccountCodesService } from './account_codes.service';

@Controller('api/account-codes')
export class AccountCodesController {
  constructor(private readonly accountCodes: AccountCodesService) {}

  @Get()
  async findAll() {
    return await this.accountCodes.findAll();
  }
}
