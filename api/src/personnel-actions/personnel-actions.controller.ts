import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UsePipes,
} from '@nestjs/common';
import { PersonnelActionsService } from './personnel-actions.service';
import {
  CreatePersonnelActionDto,
  createPersonnelActionSchema,
} from './personnel-actions.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';

@Controller('personnel-actions')
export class PersonnelActionsController {
  constructor(private readonly service: PersonnelActionsService) {}

  @Get('employee/:employeeId')
  async findByEmployee(
    @Param('employeeId', new ParseUUIDPipe({ version: '4' })) employeeId: string,
  ) {
    return this.service.findByEmployee(employeeId);
  }

  @Get('employee/:employeeId/current')
  async getEmployeeCurrentState(
    @Param('employeeId', new ParseUUIDPipe({ version: '4' })) employeeId: string,
  ) {
    return this.service.getEmployeeCurrentState(employeeId);
  }

  @Post()
  @UsePipes(new JoiValidationPipe(createPersonnelActionSchema))
  async create(@Body() body: CreatePersonnelActionDto) {
    return this.service.create(body);
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.remove(id);
  }
}