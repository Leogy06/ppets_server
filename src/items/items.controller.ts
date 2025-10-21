import { Controller, Get, UseGuards } from '@nestjs/common';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/items')
export class ItemsController {
  constructor(private readonly itemServices: ItemsService) {}

  @Get()
  async findAll() {
    return await this.itemServices.findAll();
  }
}
