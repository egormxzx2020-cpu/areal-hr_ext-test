import { Controller, Get, Post, Put, Delete, Body, Param, BadRequestException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto, createOrganizationSchema } from './organizations.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateOrganizationDto) {
    const { error, value } = createOrganizationSchema.validate(body);
    if (error) {
      throw new BadRequestException(error.details[0].message);
    }
    return this.organizationsService.create(value);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateOrganizationDto) {
    const { error, value } = createOrganizationSchema.validate(body);
    if (error) {
      throw new BadRequestException(error.details[0].message);
    }
    return this.organizationsService.update(id, value);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }
}