import { Test, TestingModule } from '@nestjs/testing';
import { AccountCodesController } from './account_codes.controller';

describe('AccountCodesController', () => {
  let controller: AccountCodesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountCodesController],
    }).compile();

    controller = module.get<AccountCodesController>(AccountCodesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
