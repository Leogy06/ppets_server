import { Test, TestingModule } from '@nestjs/testing';
import { AccountRequestsController } from './account_requests.controller';

describe('AccountRequestsController', () => {
  let controller: AccountRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountRequestsController],
    }).compile();

    controller = module.get<AccountRequestsController>(AccountRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
