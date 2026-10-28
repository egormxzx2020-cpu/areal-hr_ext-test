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
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  createDepartmentSchema,
  updateDepartmentSchema,
} from './departments.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(
    @Query('organization_id', new ParseUUIDPipe({ version: '4', optional: true }))
    orgId?: string,
  ) {
    return this.departmentsService.findAll(orgId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @UsePipes(new JoiValidationPipe(createDepartmentSchema))
  create(@Body() body: CreateDepartmentDto) {
    return this.departmentsService.create(body);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(updateDepartmentSchema)) body: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.departmentsService.remove(id);
  }
}