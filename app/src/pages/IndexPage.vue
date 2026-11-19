<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered>
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey-8 bg-white"
        active-color="primary"
        indicator-color="primary"
        align="left"
        narrow-indicator
      >
        <q-tab name="employees" icon="people" label="Сотрудники" />
        <q-tab name="organizations" icon="business" label="Организации" />
        <q-tab name="departments" icon="account_tree" label="Отделы" />
        <q-tab name="positions" icon="work" label="Должности" />
        <q-tab name="audit" icon="history" label="История изменений" />
        <q-tab
          v-if="isAdmin"
          name="users"
          icon="manage_accounts"
          label="Пользователи"
        />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- ==================== 1. СОТРУДНИКИ ==================== -->
        <q-tab-panel name="employees">
          <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
            <div class="col-12 col-sm-5">
              <q-input
                v-model="employeeSearch"
                dense
                outlined
                clearable
                placeholder="Поиск по фамилии, имени или номеру паспорта..."
                @update:model-value="debouncedLoadEmployees"
              >
                <template #prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-auto">
              <q-btn
                color="primary"
                icon="person_add"
                label="Добавить сотрудника"
                @click="openEmployeeForm()"
              />
            </div>
          </div>

          <q-table
            :rows="employees"
            :columns="employeeColumns"
            row-key="id"
            :loading="loading.employees"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
          >
            <template #body-cell-full_name="props">
              <q-td :props="props">
                <div
                  :class="
                    props.row.deleted_at
                      ? 'text-grey-6 text-strike'
                      : 'text-weight-medium'
                  "
                >
                  {{ formatFullName(props.row) }}
                </div>
                <div class="text-caption text-grey-7">
                  Д.р.: {{ props.row.birth_date }}
                </div>
              </q-td>
            </template>

            <template #body-cell-passport="props">
              <q-td :props="props">
                {{ props.row.passport_series }} {{ props.row.passport_number }}
              </q-td>
            </template>

            <template #body-cell-employment="props">
              <q-td :props="props">
                <q-badge
                  :color="employmentBadgeColor(props.row.employment_status)"
                  :label="employmentStatusLabel(props.row.employment_status)"
                />
                <div
                  v-if="props.row.employment_status === 'employed'"
                  class="text-caption q-mt-xs"
                >
                  <div>{{ props.row.current_department_name || '—' }}</div>
                  <div class="text-grey-7">
                    {{ props.row.current_position_name || '—' }} ·
                    {{ formatSalary(props.row.current_salary) }}
                  </div>
                </div>
              </q-td>
            </template>

            <template #body-cell-files_count="props">
              <q-td :props="props" class="text-center">
                <q-chip dense icon="attach_file" color="blue-1" text-color="primary">
                  {{ props.row.files_count || 0 }}
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props" class="text-center">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удален' : 'Активен'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="text-right q-gutter-xs">
                <q-btn
                  flat
                  dense
                  round
                  icon="visibility"
                  color="info"
                  @click="openEmployeeDossier(props.row.id)"
                >
                  <q-tooltip>Личное дело и приказы</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="assignment"
                  color="secondary"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="openActionDialog(props.row)"
                >
                  <q-tooltip>Оформить кадровый приказ</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="edit"
                  color="primary"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="openEmployeeForm(props.row.id)"
                >
                  <q-tooltip>Редактировать анкету</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="
                    confirmDelete('employees', props.row.id, formatFullName(props.row))
                  "
                >
                  <q-tooltip>Удалить сотрудника</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 2. ОРГАНИЗАЦИИ ==================== -->
        <q-tab-panel name="organizations">
          <div class="row justify-end q-mb-md">
            <q-btn
              color="primary"
              icon="add"
              label="Добавить организацию"
              @click="openOrgDialog()"
            />
          </div>

          <q-table
            :rows="organizations"
            :columns="orgColumns"
            row-key="id"
            :loading="loading.organizations"
            flat
            bordered
          >
            <template #body-cell-name="props">
              <q-td :props="props">
                <span
                  :class="
                    props.row.deleted_at
                      ? 'text-grey-6 text-strike'
                      : 'text-weight-medium'
                  "
                >
                  {{ props.row.name }}
                </span>
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props" class="text-center">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удалена' : 'Активна'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="text-right q-gutter-xs">
                <q-btn
                  flat
                  dense
                  round
                  icon="edit"
                  color="primary"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="openOrgDialog(props.row)"
                />
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="
                    confirmDelete('organizations', props.row.id, props.row.name)
                  "
                />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 3. ОТДЕЛЫ ==================== -->
        <q-tab-panel name="departments">
          <div class="row justify-end q-mb-md">
            <q-btn
              color="primary"
              icon="add"
              label="Добавить отдел"
              @click="openDeptDialog()"
            />
          </div>

          <q-table
            :rows="departments"
            :columns="deptColumns"
            row-key="id"
            :loading="loading.departments"
            flat
            bordered
          >
            <template #body-cell-name="props">
              <q-td :props="props">
                <span
                  :class="
                    props.row.deleted_at
                      ? 'text-grey-6 text-strike'
                      : 'text-weight-medium'
                  "
                >
                  {{ props.row.name }}
                </span>
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props" class="text-center">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удален' : 'Активен'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="text-right q-gutter-xs">
                <q-btn
                  flat
                  dense
                  round
                  icon="edit"
                  color="primary"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="openDeptDialog(props.row)"
                />
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="
                    confirmDelete('departments', props.row.id, props.row.name)
                  "
                />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 4. ДОЛЖНОСТИ ==================== -->
        <q-tab-panel name="positions">
          <div class="row justify-end q-mb-md">
            <q-btn
              color="primary"
              icon="add"
              label="Добавить должность"
              @click="openPosDialog()"
            />
          </div>

          <q-table
            :rows="positions"
            :columns="posColumns"
            row-key="id"
            :loading="loading.positions"
            flat
            bordered
          >
            <template #body-cell-name="props">
              <q-td :props="props">
                <span
                  :class="
                    props.row.deleted_at
                      ? 'text-grey-6 text-strike'
                      : 'text-weight-medium'
                  "
                >
                  {{ props.row.name }}
                </span>
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props" class="text-center">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удалена' : 'Активна'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="text-right q-gutter-xs">
                <q-btn
                  flat
                  dense
                  round
                  icon="edit"
                  color="primary"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="openPosDialog(props.row)"
                />
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="
                    confirmDelete('positions', props.row.id, props.row.name)
                  "
                />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 5. ИСТОРИЯ ИЗМЕНЕНИЙ ==================== -->
        <q-tab-panel name="audit">
          <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
            <div class="col-12 col-sm-4">
              <q-select
                v-model="auditEntityFilter"
                :options="auditEntityOptions"
                emit-value
                map-options
                dense
                outlined
                label="Фильтр по объекту"
                @update:model-value="loadAuditLogs"
              />
            </div>
            <div class="col-auto">
              <q-btn
                outline
                color="primary"
                icon="refresh"
                label="Обновить журнал"
                @click="loadAuditLogs"
              />
            </div>
          </div>

          <q-table
            :rows="auditLogs"
            :columns="auditColumns"
            row-key="id"
            :loading="loading.audit"
            flat
            bordered
            :pagination="{ rowsPerPage: 15 }"
          >
            <template #body-cell-changed_at="props">
              <q-td :props="props">
                {{ formatDateTime(props.row.changed_at) }}
              </q-td>
            </template>

            <template #body-cell-author="props">
              <q-td :props="props">
                <div v-if="props.row.user_full_name || props.row.user_login">
                  <div class="text-weight-medium">
                    {{ props.row.user_full_name || props.row.user_login }}
                  </div>
                  <div v-if="props.row.user_login" class="text-caption text-grey-7">
                    @{{ props.row.user_login }}
                  </div>
                </div>
                <span v-else class="text-grey-6">Система</span>
              </q-td>
            </template>

            <template #body-cell-entity_type="props">
              <q-td :props="props">
                <q-badge
                  color="blue-grey"
                  :label="auditEntityLabel(props.row.entity_type)"
                />
                <div class="text-caption text-grey-6">{{ props.row.entity_id }}</div>
              </q-td>
            </template>

            <template #body-cell-changed_fields="props">
              <q-td :props="props" style="white-space: normal; max-width: 480px">
                <div
                  v-for="(diff, fieldKey) in props.row.changed_fields"
                  :key="fieldKey"
                  class="text-caption q-mb-xs"
                >
                  <strong>{{ fieldKey }}:</strong>
                  <span class="text-negative">{{ formatDiffValue(diff.old) }}</span>
                  →
                  <span class="text-positive">{{ formatDiffValue(diff.new) }}</span>
                </div>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 6. ПОЛЬЗОВАТЕЛИ (ADMIN ONLY) ==================== -->
        <q-tab-panel v-if="isAdmin" name="users">
          <div class="row items-center justify-between q-mb-md">
            <div class="text-subtitle1 text-weight-medium">
              Управление учетными записями пользователей
            </div>
            <q-btn
              color="primary"
              icon="person_add"
              label="Добавить пользователя"
              @click="openUserDialog()"
            />
          </div>

          <q-table
            :rows="usersList"
            :columns="userColumns"
            row-key="id"
            :loading="loading.users"
            flat
            bordered
          >
            <template #body-cell-full_name="props">
              <q-td :props="props">
                <span
                  :class="
                    props.row.deleted_at
                      ? 'text-grey-6 text-strike'
                      : 'text-weight-medium'
                  "
                >
                  {{ formatFullName(props.row) }}
                </span>
                <q-badge
                  v-if="props.row.id === currentUser?.id"
                  outline
                  color="primary"
                  label="Вы"
                  class="q-ml-sm"
                />
              </q-td>
            </template>

            <template #body-cell-role="props">
              <q-td :props="props" class="text-center">
                <q-badge
                  :color="props.row.role === 'admin' ? 'deep-orange' : 'teal-7'"
                  :label="
                    props.row.role === 'admin'
                      ? 'Администратор'
                      : 'Менеджер по персоналу'
                  "
                />
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props" class="text-center">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удален' : 'Активен'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="text-right q-gutter-xs">
                <q-btn
                  flat
                  dense
                  round
                  icon="edit"
                  color="primary"
                  :disable="Boolean(props.row.deleted_at)"
                  @click="openUserDialog(props.row)"
                >
                  <q-tooltip>Редактировать пользователя</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  :disable="
                    Boolean(props.row.deleted_at) ||
                    props.row.id === currentUser?.id
                  "
                  @click="confirmDelete('users', props.row.id, props.row.login)"
                >
                  <q-tooltip>
                    {{
                      props.row.id === currentUser?.id
                        ? 'Нельзя удалить свою учетную запись'
                        : 'Удалить пользователя'
                    }}
                  </q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <!-- ==================== ДИАЛОГ ОРГАНИЗАЦИИ ==================== -->
    <q-dialog v-model="orgDialog.open" persistent>
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ orgDialog.id ? 'Редактировать организацию' : 'Новая организация' }}
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model.trim="orgDialog.form.name"
            label="Наименование *"
            outlined
          />
          <q-input
            v-model.trim="orgDialog.form.comment"
            label="Комментарий"
            type="textarea"
            rows="3"
            outlined
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Отмена" v-close-popup />
          <q-btn
            color="primary"
            label="Сохранить"
            :loading="saving"
            @click="saveOrg"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ ОТДЕЛА ==================== -->
    <q-dialog v-model="deptDialog.open" persistent>
      <q-card style="width: 500px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ deptDialog.id ? 'Редактировать отдел' : 'Новый отдел' }}
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="deptDialog.form.organization_id"
            :options="activeOrganizations"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            label="Организация *"
            outlined
            @update:model-value="deptDialog.form.parent_id = null"
          />
          <q-select
            v-model="deptDialog.form.parent_id"
            :options="availableParentDepartments"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            clearable
            label="Родительский отдел (необязательно)"
            outlined
          />
          <q-input
            v-model.trim="deptDialog.form.name"
            label="Наименование отдела *"
            outlined
          />
          <q-input
            v-model.trim="deptDialog.form.comment"
            label="Комментарий"
            type="textarea"
            rows="2"
            outlined
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Отмена" v-close-popup />
          <q-btn
            color="primary"
            label="Сохранить"
            :loading="saving"
            @click="saveDept"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ ДОЛЖНОСТИ ==================== -->
    <q-dialog v-model="posDialog.open" persistent>
      <q-card style="width: 440px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ posDialog.id ? 'Редактировать должность' : 'Новая должность' }}
        </q-card-section>
        <q-card-section>
          <q-input
            v-model.trim="posDialog.form.name"
            label="Наименование должности *"
            outlined
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Отмена" v-close-popup />
          <q-btn
            color="primary"
            label="Сохранить"
            :loading="saving"
            @click="savePos"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ СОТРУДНИКА ==================== -->
    <q-dialog v-model="empDialog.open" persistent>
      <q-card style="width: 780px; max-width: 96vw">
        <q-card-section class="text-h6">
          {{ empDialog.id ? 'Редактирование сотрудника' : 'Новый сотрудник' }}
        </q-card-section>
        <q-separator />
        <q-card-section style="max-height: 75vh" class="scroll q-gutter-md">
          <div class="text-subtitle2 text-primary">1. Личные данные</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-4">
              <q-input
                v-model.trim="empDialog.form.last_name"
                label="Фамилия *"
                dense
                outlined
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model.trim="empDialog.form.first_name"
                label="Имя *"
                dense
                outlined
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model.trim="empDialog.form.middle_name"
                label="Отчество"
                dense
                outlined
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model="empDialog.form.birth_date"
                type="date"
                label="Дата рождения *"
                dense
                outlined
              />
            </div>
          </div>

          <div class="text-subtitle2 text-primary">2. Паспорт РФ</div>
          <div class="row q-col-gutter-sm">
            <div class="col-6 col-sm-3">
              <q-input
                v-model="empDialog.form.passport_series"
                mask="####"
                label="Серия *"
                dense
                outlined
              />
            </div>
            <div class="col-6 col-sm-3">
              <q-input
                v-model="empDialog.form.passport_number"
                mask="######"
                label="Номер *"
                dense
                outlined
              />
            </div>
            <div class="col-6 col-sm-3">
              <q-input
                v-model="empDialog.form.passport_issue_date"
                type="date"
                label="Дата выдачи *"
                dense
                outlined
              />
            </div>
            <div class="col-6 col-sm-3">
              <q-input
                v-model="empDialog.form.passport_department_code"
                mask="###-###"
                label="Код подразделения *"
                dense
                outlined
              />
            </div>
            <div class="col-12">
              <q-input
                v-model.trim="empDialog.form.passport_issued_by"
                label="Кем выдан *"
                dense
                outlined
              />
            </div>
          </div>

          <div class="text-subtitle2 text-primary">3. Адрес регистрации</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input
                v-model.trim="empDialog.form.reg_region"
                label="Регион / Область *"
                dense
                outlined
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model.trim="empDialog.form.reg_city"
                label="Населенный пункт *"
                dense
                outlined
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model.trim="empDialog.form.reg_street"
                label="Улица *"
                dense
                outlined
              />
            </div>
            <div class="col-4 col-sm-2">
              <q-input
                v-model.trim="empDialog.form.reg_house"
                label="Дом *"
                dense
                outlined
              />
            </div>
            <div class="col-4 col-sm-2">
              <q-input
                v-model.trim="empDialog.form.reg_building"
                label="Корпус"
                dense
                outlined
              />
            </div>
            <div class="col-4 col-sm-2">
              <q-input
                v-model.trim="empDialog.form.reg_apartment"
                label="Квартира"
                dense
                outlined
              />
            </div>
          </div>

          <div class="text-subtitle2 text-primary">
            4. Сканы паспорта (JPG, PNG, WEBP, PDF до 10 МБ)
          </div>
          <q-file
            v-model="empDialog.newFiles"
            multiple
            outlined
            dense
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            label="Выберите файлы для загрузки"
            @update:model-value="uploadPassportFiles"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>

          <q-list v-if="empDialog.attachedFiles.length > 0" bordered separator dense>
            <q-item v-for="file in empDialog.attachedFiles" :key="file.id">
              <q-item-section>{{ file.name }}</q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="close"
                  color="negative"
                  @click="removeAttachedFile(file.id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat label="Отмена" v-close-popup />
          <q-btn
            color="primary"
            label="Сохранить сотрудника"
            :loading="saving"
            @click="saveEmployee"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ ЛИЧНОГО ДЕЛА И ПРИКАЗОВ ==================== -->
    <q-dialog v-model="dossierDialog.open">
      <q-card style="width: 720px; max-width: 96vw" v-if="dossierDialog.employee">
        <q-card-section class="row items-center justify-between">
          <div class="text-h6">{{ formatFullName(dossierDialog.employee) }}</div>
          <q-badge
            :color="employmentBadgeColor(dossierDialog.employee.employment_status)"
            :label="employmentStatusLabel(dossierDialog.employee.employment_status)"
          />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-sm">
          <div>
            <strong>Паспорт:</strong>
            {{ dossierDialog.employee.passport_series }}
            {{ dossierDialog.employee.passport_number }}, выдан
            {{ dossierDialog.employee.passport_issue_date }} ({{
              dossierDialog.employee.passport_department_code
            }}),
            {{ dossierDialog.employee.passport_issued_by }}
          </div>
          <div>
            <strong>Адрес регистрации:</strong>
            {{ dossierDialog.employee.reg_region }}, г.
            {{ dossierDialog.employee.reg_city }}, ул.
            {{ dossierDialog.employee.reg_street }}, д.
            {{ dossierDialog.employee.reg_house }}
            <span v-if="dossierDialog.employee.reg_building"
              >, корп. {{ dossierDialog.employee.reg_building }}</span
            >
            <span v-if="dossierDialog.employee.reg_apartment"
              >, кв. {{ dossierDialog.employee.reg_apartment }}</span
            >
          </div>

          <div class="text-subtitle2 q-pt-sm">Прикрепленные сканы паспорта:</div>
          <div
            v-if="dossierDialog.employee.passport_files?.length"
            class="row q-gutter-xs"
          >
            <q-btn
              v-for="f in dossierDialog.employee.passport_files"
              :key="f.id"
              outline
              dense
              size="sm"
              color="primary"
              icon="download"
              :label="f.name"
              @click="downloadPassportFile(f)"
            />
          </div>
          <div v-else class="text-caption text-grey-6">Сканы не прикреплены</div>

          <div class="text-subtitle2 q-pt-md">История кадровых приказов:</div>
          <q-list bordered separator dense v-if="dossierDialog.actions.length">
            <q-item v-for="(act, idx) in dossierDialog.actions" :key="act.id">
              <q-item-section>
                <q-item-label>
                  <strong>{{ actionTypeLabel(act.action_type) }}</strong> от
                  {{ act.action_date }}
                </q-item-label>
                <q-item-label caption v-if="act.action_type !== 'fire'">
                  Отдел: {{ act.department_name || '—' }} · Должность:
                  {{ act.position_name || '—' }} · Оклад:
                  {{ formatSalary(act.salary) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side v-if="idx === 0">
                <q-btn
                  flat
                  dense
                  size="sm"
                  color="negative"
                  icon="undo"
                  label="Отменить"
                  @click="cancelLastPersonnelAction(act.id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-caption text-grey-6">
            Кадровых приказов пока нет
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Закрыть" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ КАДРОВОГО ПРИКАЗА ==================== -->
    <q-dialog v-model="actionDialog.open" persistent>
      <q-card style="width: 500px; max-width: 95vw">
        <q-card-section class="text-h6">
          Кадровый приказ — {{ actionDialog.employeeName }}
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="actionDialog.form.action_type"
            :options="actionTypeOptions"
            emit-value
            map-options
            label="Тип операции *"
            outlined
          />
          <q-input
            v-model="actionDialog.form.action_date"
            type="date"
            label="Дата приказа *"
            outlined
          />
          <q-select
            v-if="['hire', 'transfer_dept'].includes(actionDialog.form.action_type)"
            v-model="actionDialog.form.department_id"
            :options="activeDepartments"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            label="Подразделение *"
            outlined
          />
          <q-select
            v-if="['hire', 'transfer_dept'].includes(actionDialog.form.action_type)"
            v-model="actionDialog.form.position_id"
            :options="activePositions"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            label="Должность *"
            outlined
          />
          <q-input
            v-if="actionDialog.form.action_type !== 'fire'"
            v-model.number="actionDialog.form.salary"
            type="number"
            step="0.01"
            label="Оклад (руб.)"
            outlined
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Отмена" v-close-popup />
          <q-btn
            color="primary"
            label="Провести приказ"
            :loading="saving"
            @click="savePersonnelAction"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ ПОЛЬЗОВАТЕЛЯ (ADMIN) ==================== -->
    <q-dialog v-model="userDialog.open" persistent>
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ userDialog.id ? 'Редактировать пользователя' : 'Новый пользователь' }}
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model.trim="userDialog.form.last_name"
            label="Фамилия *"
            outlined
          />
          <q-input
            v-model.trim="userDialog.form.first_name"
            label="Имя *"
            outlined
          />
          <q-input
            v-model.trim="userDialog.form.middle_name"
            label="Отчество"
            outlined
          />
          <q-input
            v-model.trim="userDialog.form.login"
            label="Логин (латиница, цифры, ._-) *"
            outlined
          />
          <q-select
            v-model="userDialog.form.role"
            :options="userRoleOptions"
            emit-value
            map-options
            label="Роль в системе *"
            outlined
          />
          <q-input
            v-model="userDialog.form.password"
            type="password"
            :label="
              userDialog.id
                ? 'Новый пароль (оставьте пустым, чтобы не менять)'
                : 'Пароль (минимум 8 символов) *'
            "
            outlined
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Отмена" v-close-popup />
          <q-btn
            color="primary"
            label="Сохранить"
            :loading="saving"
            @click="saveUser"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useAuth } from '../composables/useAuth';

const $q = useQuasar();
const { user: currentUser, isAdmin } = useAuth();

const activeTab = ref('employees');
const saving = ref(false);
const loading = ref({
  employees: false,
  organizations: false,
  departments: false,
  positions: false,
  audit: false,
  users: false,
});

const employees = ref([]);
const employeeSearch = ref('');
const organizations = ref([]);
const departments = ref([]);
const positions = ref([]);
const auditLogs = ref([]);
const auditEntityFilter = ref(null);
const usersList = ref([]);

const activeOrganizations = computed(() =>
  organizations.value.filter((o) => !o.deleted_at),
);
const activeDepartments = computed(() =>
  departments.value.filter((d) => !d.deleted_at),
);
const activePositions = computed(() =>
  positions.value.filter((p) => !p.deleted_at),
);

const employeeColumns = [
  {
    name: 'full_name',
    label: 'Сотрудник',
    field: 'last_name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'passport',
    label: 'Паспорт РФ',
    field: 'passport_number',
    align: 'left',
  },
  {
    name: 'employment',
    label: 'Текущий статус',
    field: 'employment_status',
    align: 'left',
  },
  {
    name: 'files_count',
    label: 'Сканы',
    field: 'files_count',
    align: 'center',
  },
  {
    name: 'status',
    label: 'Запись',
    field: 'deleted_at',
    align: 'center',
  },
  { name: 'actions', label: 'Действия', align: 'right' },
];

const orgColumns = [
  {
    name: 'name',
    label: 'Наименование',
    field: 'name',
    align: 'left',
    sortable: true,
  },
  { name: 'comment', label: 'Комментарий', field: 'comment', align: 'left' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center' },
  { name: 'actions', label: 'Действия', align: 'right' },
];

const deptColumns = [
  {
    name: 'name',
    label: 'Подразделение',
    field: 'name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'organization_name',
    label: 'Организация',
    field: 'organization_name',
    align: 'left',
  },
  {
    name: 'parent_name',
    label: 'Вышестоящий отдел',
    field: 'parent_name',
    align: 'left',
  },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center' },
  { name: 'actions', label: 'Действия', align: 'right' },
];

const posColumns = [
  {
    name: 'name',
    label: 'Должность',
    field: 'name',
    align: 'left',
    sortable: true,
  },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center' },
  { name: 'actions', label: 'Действия', align: 'right' },
];

const auditColumns = [
  { name: 'changed_at', label: 'Дата и время', field: 'changed_at', align: 'left' },
  { name: 'author', label: 'Автор', field: 'user_login', align: 'left' },
  { name: 'entity_type', label: 'Объект', field: 'entity_type', align: 'left' },
  {
    name: 'changed_fields',
    label: 'Измененные поля (Было → Стало)',
    field: 'changed_fields',
    align: 'left',
  },
];

const userColumns = [
  {
    name: 'full_name',
    label: 'ФИО',
    field: 'last_name',
    align: 'left',
    sortable: true,
  },
  { name: 'login', label: 'Логин', field: 'login', align: 'left', sortable: true },
  { name: 'role', label: 'Роль', field: 'role', align: 'center' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center' },
  { name: 'actions', label: 'Действия', align: 'right' },
];

const auditEntityOptions = [
  { label: 'Все объекты', value: null },
  { label: 'Сотрудники', value: 'Employee' },
  { label: 'Кадровые приказы', value: 'PersonnelAction' },
  { label: 'Организации', value: 'Organization' },
  { label: 'Отделы', value: 'Department' },
  { label: 'Должности', value: 'Position' },
  { label: 'Пользователи', value: 'User' },
];

const actionTypeOptions = [
  { label: 'Прием на работу', value: 'hire' },
  { label: 'Кадровый перевод', value: 'transfer_dept' },
  { label: 'Изменение оклада', value: 'change_salary' },
  { label: 'Увольнение', value: 'fire' },
];

const userRoleOptions = [
  { label: 'Администратор', value: 'admin' },
  { label: 'Менеджер по персоналу', value: 'hr_manager' },
];

function formatFullName(row) {
  return [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ');
}

function formatSalary(val) {
  if (val === null || val === undefined) return '—';
  return `${Number(val).toLocaleString('ru-RU')} ₽`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU');
}

function formatDiffValue(val) {
  if (val === null || val === undefined || val === '') return 'пусто';
  if (typeof val === 'boolean') return val ? 'да' : 'нет';
  return String(val);
}

function employmentStatusLabel(status) {
  if (status === 'employed') return 'Работает';
  if (status === 'fired') return 'Уволен';
  return 'Не оформлен';
}

function employmentBadgeColor(status) {
  if (status === 'employed') return 'positive';
  if (status === 'fired') return 'negative';
  return 'grey-7';
}

function actionTypeLabel(type) {
  const map = {
    hire: 'Прием на работу',
    transfer_dept: 'Перевод',
    change_salary: 'Изменение оклада',
    fire: 'Увольнение',
  };
  return map[type] || type;
}

function auditEntityLabel(type) {
  const map = {
    Employee: 'Сотрудник',
    PersonnelAction: 'Кадровый приказ',
    Organization: 'Организация',
    Department: 'Отдел',
    Position: 'Должность',
    User: 'Пользователь',
  };
  return map[type] || type;
}

function notifyError(err, fallback) {
  if (err?.response?.status === 401 || err?.response?.status === 403) {
    return;
  }
  const msg = err?.response?.data?.message || fallback;
  $q.notify({
    type: 'negative',
    message: Array.isArray(msg) ? msg.join('; ') : msg,
  });
}

async function loadEmployees() {
  loading.value.employees = true;
  try {
    const params = employeeSearch.value ? { search: employeeSearch.value } : {};
    const res = await api.get('/employees', { params });
    employees.value = res.data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить сотрудников');
  } finally {
    loading.value.employees = false;
  }
}

let searchTimer = null;
function debouncedLoadEmployees() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadEmployees();
  }, 300);
}

async function loadOrganizations() {
  loading.value.organizations = true;
  try {
    const res = await api.get('/organizations');
    organizations.value = res.data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить организации');
  } finally {
    loading.value.organizations = false;
  }
}

async function loadDepartments() {
  loading.value.departments = true;
  try {
    const res = await api.get('/departments');
    departments.value = res.data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить отделы');
  } finally {
    loading.value.departments = false;
  }
}

async function loadPositions() {
  loading.value.positions = true;
  try {
    const res = await api.get('/positions');
    positions.value = res.data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить должности');
  } finally {
    loading.value.positions = false;
  }
}

async function loadAuditLogs() {
  loading.value.audit = true;
  try {
    const params = { limit: 100 };
    if (auditEntityFilter.value) {
      params.entity_type = auditEntityFilter.value;
    }
    const res = await api.get('/audit-logs', { params });
    auditLogs.value = res.data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить историю изменений');
  } finally {
    loading.value.audit = false;
  }
}

async function loadUsers() {
  if (!isAdmin.value) {
    usersList.value = [];
    return;
  }
  loading.value.users = true;
  try {
    const res = await api.get('/users');
    usersList.value = res.data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить пользователей');
  } finally {
    loading.value.users = false;
  }
}

async function loadAllData() {
  const tasks = [
    loadEmployees(),
    loadOrganizations(),
    loadDepartments(),
    loadPositions(),
    loadAuditLogs(),
  ];
  if (isAdmin.value) {
    tasks.push(loadUsers());
  }
  await Promise.allSettled(tasks);
}

watch(isAdmin, (adminNow) => {
  if (adminNow) {
    loadUsers();
  } else {
    usersList.value = [];
    if (activeTab.value === 'users') {
      activeTab.value = 'employees';
    }
  }
});

// CRUD Организаций
const orgDialog = ref({ open: false, id: null, form: { name: '', comment: '' } });
function openOrgDialog(row = null) {
  orgDialog.value = {
    open: true,
    id: row?.id || null,
    form: { name: row?.name || '', comment: row?.comment || '' },
  };
}
async function saveOrg() {
  saving.value = true;
  try {
    if (orgDialog.value.id) {
      await api.put(`/organizations/${orgDialog.value.id}`, orgDialog.value.form);
    } else {
      await api.post('/organizations', orgDialog.value.form);
    }
    orgDialog.value.open = false;
    $q.notify({ type: 'positive', message: 'Организация сохранена' });
    await Promise.all([loadOrganizations(), loadAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка сохранения организации');
  } finally {
    saving.value = false;
  }
}

// CRUD Отделов
const deptDialog = ref({
  open: false,
  id: null,
  form: { organization_id: null, parent_id: null, name: '', comment: '' },
});

const availableParentDepartments = computed(() => {
  const orgId = deptDialog.value.form.organization_id;
  if (!orgId) return [];
  const editingId = deptDialog.value.id;

  const excluded = new Set();
  if (editingId) {
    excluded.add(editingId);
    let added = true;
    while (added) {
      added = false;
      for (const d of activeDepartments.value) {
        if (d.parent_id && excluded.has(d.parent_id) && !excluded.has(d.id)) {
          excluded.add(d.id);
          added = true;
        }
      }
    }
  }

  return activeDepartments.value.filter(
    (d) => d.organization_id === orgId && !excluded.has(d.id),
  );
});

function openDeptDialog(row = null) {
  deptDialog.value = {
    open: true,
    id: row?.id || null,
    form: {
      organization_id:
        row?.organization_id || activeOrganizations.value[0]?.id || null,
      parent_id: row?.parent_id || null,
      name: row?.name || '',
      comment: row?.comment || '',
    },
  };
}

async function saveDept() {
  saving.value = true;
  try {
    if (deptDialog.value.id) {
      await api.put(`/departments/${deptDialog.value.id}`, deptDialog.value.form);
    } else {
      await api.post('/departments', deptDialog.value.form);
    }
    deptDialog.value.open = false;
    $q.notify({ type: 'positive', message: 'Отдел сохранен' });
    await Promise.all([loadDepartments(), loadAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка сохранения отдела');
  } finally {
    saving.value = false;
  }
}

// CRUD Должностей
const posDialog = ref({ open: false, id: null, form: { name: '' } });
function openPosDialog(row = null) {
  posDialog.value = {
    open: true,
    id: row?.id || null,
    form: { name: row?.name || '' },
  };
}
async function savePos() {
  saving.value = true;
  try {
    if (posDialog.value.id) {
      await api.put(`/positions/${posDialog.value.id}`, posDialog.value.form);
    } else {
      await api.post('/positions', posDialog.value.form);
    }
    posDialog.value.open = false;
    $q.notify({ type: 'positive', message: 'Должность сохранена' });
    await Promise.all([loadPositions(), loadAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка сохранения должности');
  } finally {
    saving.value = false;
  }
}

// CRUD Сотрудников
const emptyEmployeeForm = () => ({
  last_name: '',
  first_name: '',
  middle_name: '',
  birth_date: '',
  passport_series: '',
  passport_number: '',
  passport_issue_date: '',
  passport_department_code: '',
  passport_issued_by: '',
  reg_region: '',
  reg_city: '',
  reg_street: '',
  reg_house: '',
  reg_building: '',
  reg_apartment: '',
});

const empDialog = ref({
  open: false,
  id: null,
  form: emptyEmployeeForm(),
  attachedFiles: [],
  newFiles: null,
});

async function openEmployeeForm(id = null) {
  if (!id) {
    empDialog.value = {
      open: true,
      id: null,
      form: emptyEmployeeForm(),
      attachedFiles: [],
      newFiles: null,
    };
    return;
  }

  try {
    const res = await api.get(`/employees/${id}`);
    const e = res.data;
    empDialog.value = {
      open: true,
      id: e.id,
      form: {
        last_name: e.last_name,
        first_name: e.first_name,
        middle_name: e.middle_name || '',
        birth_date: e.birth_date,
        passport_series: e.passport_series,
        passport_number: e.passport_number,
        passport_issue_date: e.passport_issue_date,
        passport_department_code: e.passport_department_code,
        passport_issued_by: e.passport_issued_by,
        reg_region: e.reg_region,
        reg_city: e.reg_city,
        reg_street: e.reg_street,
        reg_house: e.reg_house,
        reg_building: e.reg_building || '',
        reg_apartment: e.reg_apartment || '',
      },
      attachedFiles: e.passport_files || [],
      newFiles: null,
    };
  } catch (err) {
    notifyError(err, 'Не удалось загрузить данные сотрудника');
  }
}

async function uploadPassportFiles(files) {
  if (!files || files.length === 0) return;
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  try {
    const res = await api.post('/files/upload-multiple', formData);
    empDialog.value.attachedFiles.push(...res.data);
    empDialog.value.newFiles = null;
    $q.notify({ type: 'positive', message: 'Файлы сканов загружены' });
  } catch (err) {
    notifyError(err, 'Ошибка загрузки файлов');
  }
}

function removeAttachedFile(fileId) {
  empDialog.value.attachedFiles = empDialog.value.attachedFiles.filter(
    (f) => f.id !== fileId,
  );
}

async function saveEmployee() {
  saving.value = true;
  try {
    const payload = {
      ...empDialog.value.form,
      file_ids: empDialog.value.attachedFiles.map((f) => f.id),
    };
    if (empDialog.value.id) {
      await api.put(`/employees/${empDialog.value.id}`, payload);
    } else {
      await api.post('/employees', payload);
    }
    empDialog.value.open = false;
    $q.notify({ type: 'positive', message: 'Карточка сотрудника сохранена' });
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка сохранения сотрудника');
  } finally {
    saving.value = false;
  }
}

// Личное дело и кадровые приказы
const dossierDialog = ref({ open: false, employee: null, actions: [] });

async function openEmployeeDossier(employeeId) {
  try {
    const [empRes, actRes] = await Promise.all([
      api.get(`/employees/${employeeId}`),
      api.get(`/personnel-actions/employee/${employeeId}`),
    ]);
    dossierDialog.value = {
      open: true,
      employee: empRes.data,
      actions: actRes.data,
    };
  } catch (err) {
    notifyError(err, 'Не удалось открыть личное дело');
  }
}

async function downloadPassportFile(file) {
  try {
    const res = await api.get(`/files/${file.id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || 'scan';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    notifyError(err, 'Не удалось скачать файл');
  }
}

async function cancelLastPersonnelAction(actionId) {
  try {
    await api.delete(`/personnel-actions/${actionId}`);
    $q.notify({ type: 'positive', message: 'Последний приказ отменен' });
    if (dossierDialog.value.employee) {
      await openEmployeeDossier(dossierDialog.value.employee.id);
    }
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Не удалось отменить приказ');
  }
}

const actionDialog = ref({
  open: false,
  employeeName: '',
  form: {
    employee_id: null,
    action_type: 'hire',
    department_id: null,
    position_id: null,
    salary: null,
    action_date: new Date().toISOString().slice(0, 10),
  },
});

function openActionDialog(emp) {
  const defaultType =
    emp.employment_status === 'employed' ? 'transfer_dept' : 'hire';
  actionDialog.value = {
    open: true,
    employeeName: formatFullName(emp),
    form: {
      employee_id: emp.id,
      action_type: defaultType,
      department_id: activeDepartments.value[0]?.id || null,
      position_id: activePositions.value[0]?.id || null,
      salary: emp.current_salary || 50000,
      action_date: new Date().toISOString().slice(0, 10),
    },
  };
}

async function savePersonnelAction() {
  saving.value = true;
  try {
    const f = actionDialog.value.form;
    const payload = {
      employee_id: f.employee_id,
      action_type: f.action_type,
      action_date: f.action_date,
    };
    if (['hire', 'transfer_dept'].includes(f.action_type)) {
      payload.department_id = f.department_id;
      payload.position_id = f.position_id;
    }
    if (f.action_type !== 'fire' && f.salary !== null && f.salary !== '') {
      payload.salary = Number(f.salary);
    }

    await api.post('/personnel-actions', payload);
    actionDialog.value.open = false;
    $q.notify({ type: 'positive', message: 'Кадровый приказ проведен' });
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка проведения приказа');
  } finally {
    saving.value = false;
  }
}

// CRUD Пользователей (Admin)
const userDialog = ref({
  open: false,
  id: null,
  form: {
    last_name: '',
    first_name: '',
    middle_name: '',
    login: '',
    role: 'hr_manager',
    password: '',
  },
});

function openUserDialog(row = null) {
  userDialog.value = {
    open: true,
    id: row?.id || null,
    form: {
      last_name: row?.last_name || '',
      first_name: row?.first_name || '',
      middle_name: row?.middle_name || '',
      login: row?.login || '',
      role: row?.role || 'hr_manager',
      password: '',
    },
  };
}

async function saveUser() {
  saving.value = true;
  try {
    const payload = {
      last_name: userDialog.value.form.last_name,
      first_name: userDialog.value.form.first_name,
      middle_name: userDialog.value.form.middle_name || null,
      login: userDialog.value.form.login,
      role: userDialog.value.form.role,
    };
    if (userDialog.value.form.password) {
      payload.password = userDialog.value.form.password;
    }

    if (userDialog.value.id) {
      await api.put(`/users/${userDialog.value.id}`, payload);
    } else {
      payload.password = userDialog.value.form.password;
      await api.post('/users', payload);
    }

    userDialog.value.open = false;
    $q.notify({ type: 'positive', message: 'Пользователь сохранен' });
    await Promise.all([loadUsers(), loadAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка сохранения пользователя');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(resource, id, label) {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Вы действительно хотите удалить «${label}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/${resource}/${id}`);
      $q.notify({ type: 'positive', message: 'Запись помечена как удаленная' });
      await loadAllData();
    } catch (err) {
      notifyError(err, 'Не удалось выполнить удаление');
    }
  });
}

onMounted(() => {
  loadAllData();
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
});
</script>