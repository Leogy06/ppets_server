import { Test, TestingModule } from '@nestjs/testing';
import { TransactionConcernController } from './transaction_concern.controller';

describe('TransactionConcernController', () => {
  let controller: TransactionConcernController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionConcernController],
    }).compile();

    controller = module.get<TransactionConcernController>(TransactionConcernController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
