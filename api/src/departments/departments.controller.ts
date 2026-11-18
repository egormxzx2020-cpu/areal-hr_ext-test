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
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  createDepartmentSchema,
  updateDepartmentSchema,
} from './departments.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('departments')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin', 'hr_manager')
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
  create(
    @Body(new JoiValidationPipe(createDepartmentSchema))
    body: CreateDepartmentDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.departmentsService.create(body, userId);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(updateDepartmentSchema))
    body: UpdateDepartmentDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.departmentsService.update(id, body, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.departmentsService.remove(id, userId);
  }
}