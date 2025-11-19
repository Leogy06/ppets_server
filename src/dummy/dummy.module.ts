import { Module } from '@nestjs/common';
import { DummyController } from './dummy.controller';
import { DummyService } from './dummy.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [DummyController],
  providers: [DummyService],
  imports: [DatabaseModule],
})
export class DummyModule {}
