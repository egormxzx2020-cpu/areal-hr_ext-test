import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { PersonnelActionsService } from './personnel-actions.service';
import {
  CreatePersonnelActionDto,
  createPersonnelActionSchema,
} from './personnel-actions.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('personnel-actions')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin', 'hr_manager')
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
  async create(
    @Body(new JoiValidationPipe(createPersonnelActionSchema))
    body: CreatePersonnelActionDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.service.create(body, userId);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.service.remove(id, userId);
  }
}