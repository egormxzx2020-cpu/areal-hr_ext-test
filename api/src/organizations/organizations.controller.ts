import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  createOrganizationSchema,
  updateOrganizationSchema,
} from './organizations.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('organizations')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin', 'hr_manager')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.organizationsService.findOne(id);
  }

  @Post()
  create(
    @Body(new JoiValidationPipe(createOrganizationSchema))
    body: CreateOrganizationDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.organizationsService.create(body, userId);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(updateOrganizationSchema))
    body: UpdateOrganizationDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.organizationsService.update(id, body, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.organizationsService.remove(id, userId);
  }
}