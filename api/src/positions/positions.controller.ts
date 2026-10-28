import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UsePipes,
} from '@nestjs/common';
import { PositionsService } from './positions.service';
import {
  CreatePositionDto,
  UpdatePositionDto,
  createPositionSchema,
  updatePositionSchema,
} from './positions.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  findAll() {
    return this.positionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.positionsService.findOne(id);
  }

  @Post()
  @UsePipes(new JoiValidationPipe(createPositionSchema))
  create(@Body() body: CreatePositionDto) {
    return this.positionsService.create(body);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(updatePositionSchema)) body: UpdatePositionDto,
  ) {
    return this.positionsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.positionsService.remove(id);
  }
}