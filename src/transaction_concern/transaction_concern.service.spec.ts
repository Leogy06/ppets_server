import { Test, TestingModule } from '@nestjs/testing';
import { TransactionConcernService } from './transaction_concern.service';

describe('TransactionConcernService', () => {
  let service: TransactionConcernService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionConcernService],
    }).compile();

    service = module.get<TransactionConcernService>(TransactionConcernService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
