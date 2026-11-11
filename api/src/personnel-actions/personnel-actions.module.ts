import { Module } from '@nestjs/common';
import { PersonnelActionsService } from './personnel-actions.service';
import { PersonnelActionsController } from './personnel-actions.controller';

@Module({
  controllers: [PersonnelActionsController],
  providers: [PersonnelActionsService],
  exports: [PersonnelActionsService],
})
export class PersonnelActionsModule {}