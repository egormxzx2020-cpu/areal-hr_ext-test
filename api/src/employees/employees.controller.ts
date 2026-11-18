import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  employeeValidationSchema,
} from './employees.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('employees')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin', 'hr_manager')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.employeesService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  create(
    @Body(new JoiValidationPipe(employeeValidationSchema))
    body: CreateEmployeeDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.employeesService.create(body, userId);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(employeeValidationSchema))
    body: UpdateEmployeeDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.employeesService.update(id, body, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.employeesService.remove(id, userId);
  }
}