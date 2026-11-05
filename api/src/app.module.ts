import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { PositionsModule } from './positions/positions.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DepartmentsModule } from './departments/departments.module';
import { FilesModule } from './files/files.module';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [
    DatabaseModule,
    PositionsModule,
    OrganizationsModule,
    DepartmentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}