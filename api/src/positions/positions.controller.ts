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
  UseGuards,
} from '@nestjs/common';
import { PositionsService } from './positions.service';
import {
  CreatePositionDto,
  UpdatePositionDto,
  createPositionSchema,
  updatePositionSchema,
} from './positions.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('positions')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin', 'hr_manager')
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
  create(
    @Body(new JoiValidationPipe(createPositionSchema)) body: CreatePositionDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.positionsService.create(body, userId);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(updatePositionSchema)) body: UpdatePositionDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.positionsService.update(id, body, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.positionsService.remove(id, userId);
  }
}