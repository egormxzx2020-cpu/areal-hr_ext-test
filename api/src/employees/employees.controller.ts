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
  UsePipes,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  employeeValidationSchema,
} from './employees.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';

@Controller('employees')
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
  @UsePipes(new JoiValidationPipe(employeeValidationSchema))
  create(@Body() body: CreateEmployeeDto) {
    return this.employeesService.create(body);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(employeeValidationSchema)) body: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.employeesService.remove(id);
  }
}