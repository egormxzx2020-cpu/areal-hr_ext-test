import { Controller, Get, Post, Put, Delete, Body, Param, BadRequestException } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { CreatePositionDto, UpdatePositionDto, createPositionSchema } from './positions.dto';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  findAll() {
    return this.positionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.positionsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreatePositionDto) {
    const { error, value } = createPositionSchema.validate(body);
    if (error) {
      throw new BadRequestException(error.details[0].message);
    }
    return this.positionsService.create(value);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdatePositionDto) {
    const { error, value } = createPositionSchema.validate(body);
    if (error) {
      throw new BadRequestException(error.details[0].message);
    }
    return this.positionsService.update(id, value);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.positionsService.remove(id);
  }
}