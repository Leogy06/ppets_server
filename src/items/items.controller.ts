import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Prisma } from '@prisma/client';
import { CreateItemDto } from 'src/schemas/item.schema';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('api/items')
export class ItemsController {
  constructor(private readonly itemServices: ItemsService) {}

  @Get(':page/:pageSize')
  async findAll(
    @Req() req: Request,
    @Param('page', ParseIntPipe) page: number,
    @Param('pageSize', ParseIntPipe) pageSize: number,
    @Query('itemName') itemName?: string,
  ) {
    const user = req?.user;

    console.log('user id ', user);
    return await this.itemServices.findAll(page, pageSize, itemName);
  }

  @Post()
  async create(@Body() createUserDto: CreateItemDto, @Req() req: Request) {
    return await this.itemServices.create(createUserDto, req);
  }
}
