import { Body, Controller, Post } from '@nestjs/common';
import { AccountRequestsService } from './account_requests.service';

@Controller('api/account-requests')
export class AccountRequestsController {
  constructor(private readonly accountRequestService: AccountRequestsService) {}
}
