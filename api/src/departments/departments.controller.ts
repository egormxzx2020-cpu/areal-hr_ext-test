import { Controller, Get, Post, Put, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto, createDepartmentSchema } from './departments.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(@Query('organization_id') orgId?: string) {
    return this.departmentsService.findAll(orgId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateDepartmentDto) {
    const { error, value } = createDepartmentSchema.validate(body);
    if (error) {
      throw new BadRequestException(error.details[0].message);
    }
    return this.departmentsService.create(value);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateDepartmentDto) {
    const { error, value } = createDepartmentSchema.validate(body);
    if (error) {
      throw new BadRequestException(error.details[0].message);
    }
    return this.departmentsService.update(id, value);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}