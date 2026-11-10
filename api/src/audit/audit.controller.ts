import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('entity_type') entityType?: string,
  ) {
    const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 50;
    const parsedOffset = offset ? Math.max(0, parseInt(offset, 10)) : 0;
    return this.auditService.findAll(parsedLimit, parsedOffset, entityType);
  }

  @Get(':entityType/:entityId')
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', new ParseUUIDPipe({ version: '4' })) entityId: string,
  ) {
    return this.auditService.findByEntity(entityType, entityId);
  }
}