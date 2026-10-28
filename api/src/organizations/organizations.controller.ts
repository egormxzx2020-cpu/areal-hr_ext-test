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
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  createOrganizationSchema,
  updateOrganizationSchema,
} from './organizations.dto';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';

@Controller('organizations')
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
  @UsePipes(new JoiValidationPipe(createOrganizationSchema))
  create(@Body() body: CreateOrganizationDto) {
    return this.organizationsService.create(body);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.organizationsService.remove(id);
  }
}