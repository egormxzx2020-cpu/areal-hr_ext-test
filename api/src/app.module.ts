import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { PositionsModule } from './positions/positions.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DepartmentsModule } from './departments/departments.module';
import { FilesModule } from './files/files.module';
import { EmployeesModule } from './employees/employees.module';
import { AuditModule } from './audit/audit.module';
import { PersonnelActionsModule } from './personnel-actions/personnel-actions.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    PositionsModule,
    OrganizationsModule,
    DepartmentsModule,
    FilesModule,
    EmployeesModule,
    AuditModule,
    PersonnelActionsModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}