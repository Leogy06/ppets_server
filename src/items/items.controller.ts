import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Prisma } from '@prisma/client';
import { CreateItemDto } from 'src/schemas/item.schema';

@UseGuards(JwtAuthGuard)
@Controller('api/items')
export class ItemsController {
  constructor(private readonly itemServices: ItemsService) {}

  @Get(':page/:pageSize')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('pageSize', ParseIntPipe) pageSize: number,
  ) {
    return await this.itemServices.findAll(page, pageSize);
  }

  @Post()
  async create(@Body() createUserDto: CreateItemDto) {
    return await this.itemServices.create(createUserDto);
  }
}
