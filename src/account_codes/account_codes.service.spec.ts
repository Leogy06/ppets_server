import { Test, TestingModule } from '@nestjs/testing';
import { AccountCodesService } from './account_codes.service';

describe('AccountCodesService', () => {
  let service: AccountCodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountCodesService],
    }).compile();

    service = module.get<AccountCodesService>(AccountCodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
