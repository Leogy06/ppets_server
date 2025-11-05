import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Prisma } from '@prisma/client';
import { CreateItemDto, UpdateItemDto } from 'src/schemas/item.schema';
import type { Request } from 'express';
import { ExtendRequest } from 'src/user/dto/create-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/items')
export class ItemsController {
  constructor(private readonly itemServices: ItemsService) {}

  @Get(':page/:pageSize')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('pageSize', ParseIntPipe) pageSize: number,
    @Query('itemName') itemName?: string,
  ) {
    return await this.itemServices.findAll(page, pageSize, itemName);
  }

  @Post()
  async create(@Body() createItemDto: CreateItemDto, @Req() req: Request) {
    return await this.itemServices.create(createItemDto, req);
  }

  @Put(':itemId')
  async update(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    const updatedItem = await this.itemServices.update(updateItemDto, itemId);

    return updatedItem;
  }
}
