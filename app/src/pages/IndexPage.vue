<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered>
      <div class="row items-center justify-between q-px-md q-pt-sm">
        <q-tabs
          v-model="activeTab"
          dense
          class="text-grey-8"
          active-color="primary"
          indicator-color="primary"
          align="left"
          narrow-indicator
          @update:model-value="onTabChange"
        >
          <q-tab name="employees" icon="people" label="Сотрудники" />
          <q-tab name="organizations" icon="business" label="Организации" />
          <q-tab name="departments" icon="account_tree" label="Отделы" />
          <q-tab name="positions" icon="work" label="Должности" />
          <q-tab name="audit" icon="history" label="История изменений" />
        </q-tabs>

        <q-toggle
          v-if="activeTab !== 'audit'"
          v-model="showDeleted"
          label="Показывать удаленные"
          color="negative"
          dense
        />
      </div>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- ==================== 1. ВКЛАДКА: СОТРУДНИКИ ==================== -->
        <q-tab-panel name="employees">
          <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
            <div class="col-12 col-md-5">
              <q-input
                v-model="employeeSearch"
                outlined
                dense
                clearable
                debounce="350"
                placeholder="Поиск по фамилии, имени или номеру паспорта..."
                @update:model-value="fetchEmployees"
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
                @click="openCreateEmployeeDialog"
              />
            </div>
          </div>

          <q-table
            :rows="filteredEmployees"
            :columns="employeeColumns"
            row-key="id"
            :loading="loadingEmployees"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
            no-data-label="Сотрудники не найдены"
          >
            <template #body-cell-full_name="props">
              <q-td :props="props">
                <div class="text-weight-medium">
                  {{ formatFullName(props.row) }}
                </div>
                <div class="text-caption text-grey-7">
                  Д.р.: {{ formatDate(props.row.birth_date) }}
                </div>
              </q-td>
            </template>

            <template #body-cell-passport="props">
              <q-td :props="props">
                <div>
                  {{ props.row.passport_series }} {{ props.row.passport_number }}
                </div>
                <div class="text-caption text-grey-7">
                  Выдан: {{ formatDate(props.row.passport_issue_date) }}
                </div>
              </q-td>
            </template>

            <template #body-cell-employment="props">
              <q-td :props="props">
                <q-badge
                  :color="getEmploymentStatusColor(props.row.employment_status)"
                  :label="getEmploymentStatusLabel(props.row.employment_status)"
                />
                <div
                  v-if="props.row.employment_status === 'employed'"
                  class="text-caption q-mt-xs"
                >
                  <div>
                    <strong>{{ props.row.current_position_name || '—' }}</strong>
                  </div>
                  <div class="text-grey-7">
                    {{ props.row.current_department_name || '—' }} ·
                    {{ formatSalary(props.row.current_salary) }}
                  </div>
                </div>
              </q-td>
            </template>

            <template #body-cell-files_count="props">
              <q-td :props="props" class="text-center">
                <q-chip
                  dense
                  size="sm"
                  :color="props.row.files_count > 0 ? 'blue-1' : 'grey-2'"
                  :text-color="props.row.files_count > 0 ? 'primary' : 'grey-7'"
                  icon="attach_file"
                >
                  {{ props.row.files_count || 0 }}
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удален' : 'Активен'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="q-gutter-xs">
                <q-btn
                  flat
                  round
                  dense
                  color="info"
                  icon="visibility"
                  @click="openEmployeeDetails(props.row)"
                >
                  <q-tooltip>Личное дело и история приказов</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="teal"
                  icon="assignment_ind"
                  @click="openActionDialog(props.row)"
                >
                  <q-tooltip>Провести кадровый приказ</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  @click="openEditEmployeeDialog(props.row)"
                >
                  <q-tooltip>Редактировать анкету</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  @click="confirmDeleteEmployee(props.row)"
                >
                  <q-tooltip>Удалить сотрудника</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 2. ВКЛАДКА: ОРГАНИЗАЦИИ ==================== -->
        <q-tab-panel name="organizations">
          <div class="row justify-end q-mb-md">
            <q-btn
              color="primary"
              icon="add"
              label="Добавить организацию"
              @click="openCreateOrgDialog"
            />
          </div>

          <q-table
            :rows="filteredOrganizations"
            :columns="orgColumns"
            row-key="id"
            :loading="loadingOrgs"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
            no-data-label="Организации не найдены"
          >
            <template #body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удалена' : 'Активна'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="q-gutter-xs">
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  @click="openEditOrgDialog(props.row)"
                >
                  <q-tooltip>Редактировать</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  @click="confirmDeleteOrg(props.row)"
                >
                  <q-tooltip>Удалить</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 3. ВКЛАДКА: ОТДЕЛЫ ==================== -->
        <q-tab-panel name="departments">
          <div class="row justify-end q-mb-md">
            <q-btn
              color="primary"
              icon="add"
              label="Добавить отдел"
              @click="openCreateDeptDialog"
            />
          </div>

          <q-table
            :rows="filteredDepartments"
            :columns="deptColumns"
            row-key="id"
            :loading="loadingDepts"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
            no-data-label="Отделы не найдены"
          >
            <template #body-cell-parent_name="props">
              <q-td :props="props">
                {{ props.row.parent_name || '— (Корневой отдел)' }}
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удален' : 'Активен'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="q-gutter-xs">
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  @click="openEditDeptDialog(props.row)"
                >
                  <q-tooltip>Редактировать</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  @click="confirmDeleteDept(props.row)"
                >
                  <q-tooltip>Удалить</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 4. ВКЛАДКА: ДОЛЖНОСТИ ==================== -->
        <q-tab-panel name="positions">
          <div class="row justify-end q-mb-md">
            <q-btn
              color="primary"
              icon="add"
              label="Добавить должность"
              @click="openCreatePositionDialog"
            />
          </div>

          <q-table
            :rows="filteredPositions"
            :columns="positionColumns"
            row-key="id"
            :loading="loadingPositions"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
            no-data-label="Должности не найдены"
          >
            <template #body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.deleted_at ? 'negative' : 'positive'"
                  :label="props.row.deleted_at ? 'Удалена' : 'Активна'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="q-gutter-xs">
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  @click="openEditPositionDialog(props.row)"
                >
                  <q-tooltip>Редактировать</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="!props.row.deleted_at"
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  @click="confirmDeletePosition(props.row)"
                >
                  <q-tooltip>Удалить</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ==================== 5. ВКЛАДКА: ИСТОРИЯ ИЗМЕНЕНИЙ (AUDIT_LOGS) ==================== -->
        <q-tab-panel name="audit">
          <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
            <div class="col-12 col-md-4">
              <q-select
                v-model="auditEntityFilter"
                :options="auditEntityOptions"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                outlined
                dense
                clearable
                label="Фильтр по типу объекта"
                @update:model-value="fetchAuditLogs"
              />
            </div>
            <div class="col-auto">
              <q-btn
                outline
                color="primary"
                icon="refresh"
                label="Обновить журнал"
                :loading="loadingAudit"
                @click="fetchAuditLogs"
              />
            </div>
          </div>

          <q-table
            :rows="auditLogs"
            :columns="auditColumns"
            row-key="id"
            :loading="loadingAudit"
            flat
            bordered
            :pagination="{ rowsPerPage: 15 }"
            no-data-label="Записи в журнале аудита отсутствуют"
          >
            <template #body-cell-changed_at="props">
              <q-td :props="props" style="white-space: nowrap">
                {{ formatDateTime(props.row.changed_at) }}
              </q-td>
            </template>

            <template #body-cell-operation="props">
              <q-td :props="props">
                <q-badge
                  :color="getAuditOperationBadge(props.row.changed_fields).color"
                  :label="getAuditOperationBadge(props.row.changed_fields).label"
                />
              </q-td>
            </template>

            <template #body-cell-entity="props">
              <q-td :props="props">
                <div>
                  <q-badge
                    outline
                    :color="getEntityTypeColor(props.row.entity_type)"
                    :label="getEntityTypeLabel(props.row.entity_type)"
                  />
                </div>
                <div class="text-caption text-grey-7 q-mt-xs font-mono">
                  ID: {{ props.row.entity_id }}
                </div>
              </q-td>
            </template>

            <template #body-cell-user_id="props">
              <q-td :props="props">
                <span v-if="props.row.user_id" class="text-caption">
                  {{ props.row.user_id }}
                </span>
                <q-chip v-else dense size="sm" color="grey-3" text-color="grey-8">
                  Система
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-changed_fields="props">
              <q-td :props="props">
                <div
                  v-for="(diff, fieldKey) in props.row.changed_fields"
                  :key="fieldKey"
                  class="q-py-xs text-caption"
                >
                  <strong>{{ formatAuditFieldName(String(fieldKey)) }}:</strong>
                  <span class="text-negative q-mx-xs">
                    {{ formatAuditFieldValue(String(fieldKey), diff?.old) }}
                  </span>
                  <q-icon name="arrow_forward" size="12px" class="text-grey-6" />
                  <span class="text-positive text-weight-medium q-ml-xs">
                    {{ formatAuditFieldValue(String(fieldKey), diff?.new) }}
                  </span>
                </div>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <!-- ==================== ДИАЛОГ: СОЗДАНИЕ / РЕДАКТИРОВАНИЕ СОТРУДНИКА ==================== -->
    <q-dialog v-model="employeeDialog" persistent>
      <q-card style="width: 780px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingEmployeeId ? 'Редактирование сотрудника' : 'Новый сотрудник' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="saveEmployee">
          <q-card-section class="scroll" style="max-height: 75vh">
            <!-- Блок 1: Личные данные -->
            <div class="text-subtitle2 text-primary q-mb-sm">
              1. Личные данные
            </div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-12 col-sm-4">
                <q-input
                  v-model="employeeForm.last_name"
                  label="Фамилия *"
                  outlined
                  dense
                  :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model="employeeForm.first_name"
                  label="Имя *"
                  outlined
                  dense
                  :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model="employeeForm.middle_name"
                  label="Отчество"
                  outlined
                  dense
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model="employeeForm.birth_date"
                  label="Дата рождения *"
                  type="date"
                  outlined
                  dense
                  stack-label
                  :rules="[(val) => !!val || 'Укажите дату рождения']"
                />
              </div>
            </div>

            <!-- Блок 2: Паспорт РФ -->
            <div class="text-subtitle2 text-primary q-mb-sm">
              2. Паспортные данные (РФ)
            </div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-6 col-sm-3">
                <q-input
                  v-model="employeeForm.passport_series"
                  label="Серия *"
                  mask="####"
                  outlined
                  dense
                  :rules="[(val) => /^\d{4}$/.test(val) || 'Ровно 4 цифры']"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model="employeeForm.passport_number"
                  label="Номер *"
                  mask="######"
                  outlined
                  dense
                  :rules="[(val) => /^\d{6}$/.test(val) || 'Ровно 6 цифр']"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model="employeeForm.passport_issue_date"
                  label="Дата выдачи *"
                  type="date"
                  outlined
                  dense
                  stack-label
                  :rules="[(val) => !!val || 'Укажите дату выдачи']"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model="employeeForm.passport_department_code"
                  label="Код подразделения *"
                  mask="###-###"
                  outlined
                  dense
                  :rules="[(val) => /^\d{3}-\d{3}$/.test(val) || 'Формат 000-000']"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model="employeeForm.passport_issued_by"
                  label="Кем выдан *"
                  outlined
                  dense
                  :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
                />
              </div>
            </div>

            <!-- Блок 3: Адрес регистрации -->
            <div class="text-subtitle2 text-primary q-mb-sm">
              3. Адрес регистрации
            </div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="employeeForm.reg_region"
                  label="Регион / Область *"
                  outlined
                  dense
                  :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="employeeForm.reg_city"
                  label="Город / Населенный пункт *"
                  outlined
                  dense
                  :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="employeeForm.reg_street"
                  label="Улица *"
                  outlined
                  dense
                  :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
                />
              </div>
              <div class="col-4 col-sm-2">
                <q-input
                  v-model="employeeForm.reg_house"
                  label="Дом *"
                  outlined
                  dense
                  :rules="[(val) => !!val?.trim() || 'Обяз.']"
                />
              </div>
              <div class="col-4 col-sm-2">
                <q-input
                  v-model="employeeForm.reg_building"
                  label="Корпус"
                  outlined
                  dense
                />
              </div>
              <div class="col-4 col-sm-2">
                <q-input
                  v-model="employeeForm.reg_apartment"
                  label="Квартира"
                  outlined
                  dense
                />
              </div>
            </div>

            <!-- Блок 4: Сканы паспорта -->
            <div class="text-subtitle2 text-primary q-mb-sm">
              4. Сканы паспорта (JPG, PNG, WEBP, PDF до 10 МБ)
            </div>
            <q-file
              v-model="selectedUploadFiles"
              multiple
              outlined
              dense
              clearable
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              label="Выберите файлы сканов для загрузки"
              :loading="uploadingFiles"
              @update:model-value="handleFilesUpload"
            >
              <template #prepend>
                <q-icon name="cloud_upload" />
              </template>
            </q-file>

            <div v-if="attachedFiles.length > 0" class="q-mt-sm">
              <div class="text-caption text-positive q-mb-xs">
                Прикреплено файлов: {{ attachedFiles.length }}
              </div>
              <q-list bordered separator dense class="rounded-borders">
                <q-item v-for="file in attachedFiles" :key="file.id">
                  <q-item-section avatar>
                    <q-icon name="description" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ file.name }}</q-item-label>
                    <q-item-label caption>
                      {{ formatFileSize(file.size) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row q-gutter-xs">
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        color="primary"
                        icon="open_in_new"
                        :href="getFileDownloadUrl(file.id)"
                        target="_blank"
                      >
                        <q-tooltip>Открыть скан</q-tooltip>
                      </q-btn>
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        color="negative"
                        icon="close"
                        @click="removeAttachedFile(file.id)"
                      >
                        <q-tooltip>Открепить файл</q-tooltip>
                      </q-btn>
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat label="Отмена" color="grey-7" />
            <q-btn
              type="submit"
              color="primary"
              label="Сохранить сотрудника"
              :loading="savingEmployee"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ: ЛИЧНОЕ ДЕЛО И ИСТОРИЯ ПРИКАЗОВ ==================== -->
    <q-dialog v-model="detailsDialog">
      <q-card style="width: 800px; max-width: 95vw">
        <q-card-section class="row items-center bg-info text-white">
          <div class="text-h6">
            Личное дело: {{ selectedEmployee ? formatFullName(selectedEmployee) : '' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-card-section v-if="selectedEmployee" class="scroll" style="max-height: 75vh">
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-12 col-sm-6">
              <q-card flat bordered class="q-pa-sm bg-grey-1">
                <div class="text-subtitle2 text-primary q-mb-xs">
                  Паспорт и регистрация
                </div>
                <div class="text-body2">
                  <strong>Дата рождения:</strong>
                  {{ formatDate(selectedEmployee.birth_date) }}
                </div>
                <div class="text-body2">
                  <strong>Паспорт:</strong>
                  {{ selectedEmployee.passport_series }}
                  {{ selectedEmployee.passport_number }} (выдан
                  {{ formatDate(selectedEmployee.passport_issue_date) }}, код
                  {{ selectedEmployee.passport_department_code }})
                </div>
                <div class="text-body2">
                  <strong>Кем выдан:</strong>
                  {{ selectedEmployee.passport_issued_by }}
                </div>
                <div class="text-body2 q-mt-xs">
                  <strong>Адрес:</strong>
                  {{ selectedEmployee.reg_region }}, г.
                  {{ selectedEmployee.reg_city }}, ул.
                  {{ selectedEmployee.reg_street }}, д.
                  {{ selectedEmployee.reg_house }}
                  <span v-if="selectedEmployee.reg_building">
                    , корп. {{ selectedEmployee.reg_building }}
                  </span>
                  <span v-if="selectedEmployee.reg_apartment">
                    , кв. {{ selectedEmployee.reg_apartment }}
                  </span>
                </div>
              </q-card>
            </div>

            <div class="col-12 col-sm-6">
              <q-card flat bordered class="q-pa-sm bg-grey-1">
                <div class="text-subtitle2 text-primary q-mb-xs">
                  Текущее кадровое состояние
                </div>
                <div class="q-mb-xs">
                  <q-badge
                    :color="getEmploymentStatusColor(selectedEmployee.employment_status)"
                    :label="getEmploymentStatusLabel(selectedEmployee.employment_status)"
                  />
                </div>
                <div class="text-body2">
                  <strong>Отдел:</strong>
                  {{ selectedEmployee.current_department_name || '—' }}
                </div>
                <div class="text-body2">
                  <strong>Должность:</strong>
                  {{ selectedEmployee.current_position_name || '—' }}
                </div>
                <div class="text-body2">
                  <strong>Оклад:</strong>
                  {{
                    selectedEmployee.current_salary
                      ? formatSalary(selectedEmployee.current_salary)
                      : '—'
                  }}
                </div>
              </q-card>
            </div>
          </div>

          <!-- Сканы паспорта -->
          <div class="text-subtitle2 text-primary q-mb-xs">
            Прикрепленные сканы паспорта
          </div>
          <div
            v-if="
              !selectedEmployee.passport_files ||
              selectedEmployee.passport_files.length === 0
            "
            class="text-caption text-grey-7 q-mb-md"
          >
            Сканы документов не прикреплены
          </div>
          <div v-else class="row q-gutter-sm q-mb-md">
            <q-btn
              v-for="file in selectedEmployee.passport_files"
              :key="file.id"
              outline
              dense
              color="primary"
              icon="description"
              :label="`${file.name} (${formatFileSize(file.size)})`"
              :href="getFileDownloadUrl(file.id)"
              target="_blank"
            />
          </div>

          <!-- История кадровых перемещений -->
          <div class="row items-center justify-between q-mb-sm">
            <div class="text-subtitle2 text-primary">
              Хронология кадровых приказов
            </div>
            <q-btn
              v-if="!selectedEmployee.deleted_at"
              dense
              color="teal"
              icon="add"
              label="Новый приказ"
              @click="openActionDialog(selectedEmployee)"
            />
          </div>

          <q-inner-loading :showing="loadingEmployeeActions" />

          <div
            v-if="!loadingEmployeeActions && employeeActions.length === 0"
            class="text-caption text-grey-7"
          >
            Кадровые приказы еще не оформлялись
          </div>

          <q-timeline v-else color="primary" layout="dense">
            <q-timeline-entry
              v-for="(act, idx) in employeeActions"
              :key="act.id"
              :title="`${getActionTypeLabel(act.action_type)} — ${formatDate(
                act.action_date,
              )}`"
              :color="getActionTypeColor(act.action_type)"
            >
              <div class="row items-center justify-between">
                <div class="text-body2">
                  <div v-if="act.department_name">
                    Подразделение: <strong>{{ act.department_name }}</strong>
                    <span v-if="act.organization_name" class="text-grey-7">
                      ({{ act.organization_name }})
                    </span>
                  </div>
                  <div v-if="act.position_name">
                    Должность: <strong>{{ act.position_name }}</strong>
                  </div>
                  <div v-if="act.salary">
                    Оклад: <strong>{{ formatSalary(act.salary) }}</strong>
                  </div>
                </div>
                <q-btn
                  v-if="idx === 0 && !selectedEmployee.deleted_at"
                  flat
                  round
                  dense
                  size="sm"
                  color="negative"
                  icon="delete_outline"
                  @click="confirmDeletePersonnelAction(act)"
                >
                  <q-tooltip>Отменить последний приказ</q-tooltip>
                </q-btn>
              </div>
            </q-timeline-entry>
          </q-timeline>
        </q-card-section>

        <q-separator />
        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Закрыть" color="primary" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ: ПРОВЕДЕНИЕ КАДРОВОГО ПРИКАЗА ==================== -->
    <q-dialog v-model="actionDialog" persistent>
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="row items-center bg-teal text-white">
          <div class="text-h6">Новый кадровый приказ</div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="submitPersonnelAction">
          <q-card-section class="q-gutter-sm">
            <div v-if="actionTargetEmployee" class="text-body2 q-mb-sm">
              Сотрудник:
              <strong>{{ formatFullName(actionTargetEmployee) }}</strong>
            </div>

            <q-select
              v-model="actionForm.action_type"
              :options="availableActionTypes"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              outlined
              dense
              label="Тип кадровой операции *"
            />

            <q-input
              v-model="actionForm.action_date"
              label="Дата приказа *"
              type="date"
              outlined
              dense
              stack-label
              :rules="[(val) => !!val || 'Укажите дату приказа']"
            />

            <q-select
              v-if="
                actionForm.action_type === 'hire' ||
                actionForm.action_type === 'transfer_dept'
              "
              v-model="actionForm.department_id"
              :options="activeDepartments"
              option-value="id"
              :option-label="
                (d) =>
                  d.organization_name ? `${d.name} (${d.organization_name})` : d.name
              "
              emit-value
              map-options
              outlined
              dense
              label="Подразделение *"
              :rules="[(val) => !!val || 'Выберите отдел']"
            />

            <q-select
              v-if="
                actionForm.action_type === 'hire' ||
                actionForm.action_type === 'transfer_dept'
              "
              v-model="actionForm.position_id"
              :options="activePositions"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              outlined
              dense
              label="Должность *"
              :rules="[(val) => !!val || 'Выберите должность']"
            />

            <q-input
              v-if="
                actionForm.action_type === 'hire' ||
                actionForm.action_type === 'change_salary'
              "
              v-model.number="actionForm.salary"
              label="Оклад (руб.) *"
              type="number"
              step="0.01"
              min="1"
              max="9999999999.99"
              outlined
              dense
              :rules="[
                (val) => (val !== null && val > 0) || 'Укажите положительный оклад',
                (val) => val <= 9999999999.99 || 'Максимум 9 999 999 999.99',
              ]"
            />
          </q-card-section>

          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat label="Отмена" color="grey-7" />
            <q-btn
              type="submit"
              color="teal"
              label="Провести приказ"
              :loading="savingAction"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ: ОРГАНИЗАЦИЯ ==================== -->
    <q-dialog v-model="orgDialog" persistent>
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingOrgId ? 'Редактировать организацию' : 'Новая организация' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="saveOrg">
          <q-card-section class="q-gutter-sm">
            <q-input
              v-model="orgForm.name"
              label="Наименование *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
            />
            <q-input
              v-model="orgForm.comment"
              label="Комментарий"
              type="textarea"
              rows="3"
              outlined
              dense
            />
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat label="Отмена" color="grey-7" />
            <q-btn
              type="submit"
              color="primary"
              label="Сохранить"
              :loading="savingOrg"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ: ОТДЕЛ ==================== -->
    <q-dialog v-model="deptDialog" persistent>
      <q-card style="width: 500px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingDeptId ? 'Редактировать отдел' : 'Новый отдел' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="saveDept">
          <q-card-section class="q-gutter-sm">
            <q-select
              v-model="deptForm.organization_id"
              :options="activeOrganizations"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              outlined
              dense
              label="Организация *"
              :rules="[(val) => !!val || 'Выберите организацию']"
              @update:model-value="deptForm.parent_id = null"
            />
            <q-select
              v-model="deptForm.parent_id"
              :options="availableParentDepartments"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              outlined
              dense
              clearable
              label="Родительский отдел (необязательно)"
              :disable="!deptForm.organization_id"
            />
            <q-input
              v-model="deptForm.name"
              label="Наименование отдела *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
            />
            <q-input
              v-model="deptForm.comment"
              label="Комментарий"
              type="textarea"
              rows="2"
              outlined
              dense
            />
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat label="Отмена" color="grey-7" />
            <q-btn
              type="submit"
              color="primary"
              label="Сохранить"
              :loading="savingDept"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- ==================== ДИАЛОГ: ДОЛЖНОСТЬ ==================== -->
    <q-dialog v-model="positionDialog" persistent>
      <q-card style="width: 440px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingPositionId ? 'Редактировать должность' : 'Новая должность' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="savePosition">
          <q-card-section>
            <q-input
              v-model="positionForm.name"
              label="Наименование должности *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
            />
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat label="Отмена" color="grey-7" />
            <q-btn
              type="submit"
              color="primary"
              label="Сохранить"
              :loading="savingPosition"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';

const $q = useQuasar();

// ==================== ОБЩЕЕ СОСТОЯНИЕ ====================
const activeTab = ref('employees');
const showDeleted = ref(false);

const employees = ref([]);
const organizations = ref([]);
const departments = ref([]);
const positions = ref([]);
const auditLogs = ref([]);

const loadingEmployees = ref(false);
const loadingOrgs = ref(false);
const loadingDepts = ref(false);
const loadingPositions = ref(false);
const loadingAudit = ref(false);

const employeeSearch = ref('');
const auditEntityFilter = ref(null);

const auditEntityOptions = [
  { label: 'Сотрудники', value: 'Employee' },
  { label: 'Кадровые приказы', value: 'PersonnelAction' },
  { label: 'Организации', value: 'Organization' },
  { label: 'Отделы', value: 'Department' },
  { label: 'Должности', value: 'Position' },
];

// ==================== КОЛОНКИ ТАБЛИЦ ====================
const employeeColumns = [
  { name: 'full_name', label: 'ФИО сотрудника', field: 'last_name', align: 'left', sortable: true },
  { name: 'passport', label: 'Паспорт РФ', field: 'passport_number', align: 'left' },
  { name: 'employment', label: 'Кадровый статус и должность', field: 'employment_status', align: 'left' },
  { name: 'files_count', label: 'Сканы', field: 'files_count', align: 'center' },
  { name: 'status', label: 'Запись', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const orgColumns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'comment', label: 'Комментарий', field: (row) => row.comment || '—', align: 'left' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const deptColumns = [
  { name: 'name', label: 'Отдел', field: 'name', align: 'left', sortable: true },
  { name: 'organization_name', label: 'Организация', field: 'organization_name', align: 'left', sortable: true },
  { name: 'parent_name', label: 'Родительский отдел', field: 'parent_name', align: 'left' },
  { name: 'comment', label: 'Комментарий', field: (row) => row.comment || '—', align: 'left' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const positionColumns = [
  { name: 'name', label: 'Должность', field: 'name', align: 'left', sortable: true },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const auditColumns = [
  { name: 'changed_at', label: 'Дата и время', field: 'changed_at', align: 'left', sortable: true },
  { name: 'operation', label: 'Событие', field: 'id', align: 'left' },
  { name: 'entity', label: 'Объект', field: 'entity_type', align: 'left' },
  { name: 'user_id', label: 'Автор', field: 'user_id', align: 'left' },
  { name: 'changed_fields', label: 'Измененные поля (Было → Стало)', field: 'changed_fields', align: 'left' },
];

// ==================== ВЫЧИСЛЯЕМЫЕ СПИСКИ ====================
const filteredEmployees = computed(() =>
  showDeleted.value ? employees.value : employees.value.filter((e) => !e.deleted_at),
);

const filteredOrganizations = computed(() =>
  showDeleted.value ? organizations.value : organizations.value.filter((o) => !o.deleted_at),
);

const filteredDepartments = computed(() =>
  showDeleted.value ? departments.value : departments.value.filter((d) => !d.deleted_at),
);

const filteredPositions = computed(() =>
  showDeleted.value ? positions.value : positions.value.filter((p) => !p.deleted_at),
);

const activeOrganizations = computed(() =>
  organizations.value.filter((o) => !o.deleted_at),
);

const activePositions = computed(() =>
  positions.value.filter((p) => !p.deleted_at),
);

const activeDepartments = computed(() =>
  departments.value.filter((d) => !d.deleted_at),
);

// Рекурсивно исключаем сам отдел и всех его потомков при выборе родителя (защита от циклов A -> B -> A)
const availableParentDepartments = computed(() => {
  if (!deptForm.value.organization_id) return [];

  const orgDepts = activeDepartments.value.filter(
    (d) => d.organization_id === deptForm.value.organization_id,
  );

  if (!editingDeptId.value) return orgDepts;

  const excludedIds = new Set([editingDeptId.value]);
  let added = true;
  while (added) {
    added = false;
    for (const dept of orgDepts) {
      if (dept.parent_id && excludedIds.has(dept.parent_id) && !excludedIds.has(dept.id)) {
        excludedIds.add(dept.id);
        added = true;
      }
    }
  }

  return orgDepts.filter((d) => !excludedIds.has(d.id));
});

// ==================== УТИЛИТЫ ФОРМАТИРОВАНИЯ ====================
function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractErrorMessage(err, fallback = 'Ошибка при выполнении операции') {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('; ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return err?.message || fallback;
}

function notifySuccess(message) {
  $q.notify({ type: 'positive', message, position: 'top-right' });
}

function notifyError(err, fallback) {
  $q.notify({
    type: 'negative',
    message: extractErrorMessage(err, fallback),
    position: 'top-right',
    timeout: 4500,
  });
}

function formatFullName(emp) {
  return [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ');
}

function formatDate(val) {
  if (!val) return '—';
  const str = String(val).slice(0, 10);
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return str;
}

function formatDateTime(val) {
  if (!val) return '—';
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return String(val);
  return dt.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSalary(val) {
  if (val === null || val === undefined) return '—';
  return `${Number(val).toLocaleString('ru-RU')} ₽`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function getFileDownloadUrl(fileId) {
  const baseUrl = api.defaults.baseURL || 'http://localhost:3000';
  return `${baseUrl}/files/${fileId}/download`;
}

function getEmploymentStatusLabel(status) {
  if (status === 'employed') return 'Работает';
  if (status === 'fired') return 'Уволен';
  return 'Не принят';
}

function getEmploymentStatusColor(status) {
  if (status === 'employed') return 'positive';
  if (status === 'fired') return 'negative';
  return 'grey-7';
}

function getActionTypeLabel(type) {
  const map = {
    hire: 'Прием на работу',
    transfer_dept: 'Кадровый перевод',
    change_salary: 'Изменение оклада',
    fire: 'Увольнение',
  };
  return map[type] || type;
}

function getActionTypeColor(type) {
  const map = {
    hire: 'positive',
    transfer_dept: 'info',
    change_salary: 'warning',
    fire: 'negative',
  };
  return map[type] || 'primary';
}

function getEntityTypeLabel(type) {
  const map = {
    Employee: 'Сотрудник',
    PersonnelAction: 'Кадровый приказ',
    Organization: 'Организация',
    Department: 'Отдел',
    Position: 'Должность',
  };
  return map[type] || type;
}

function getEntityTypeColor(type) {
  const map = {
    Employee: 'primary',
    PersonnelAction: 'teal',
    Organization: 'indigo',
    Department: 'deep-purple',
    Position: 'blue-grey',
  };
  return map[type] || 'grey-8';
}

function getAuditOperationBadge(changedFields) {
  if (!changedFields || typeof changedFields !== 'object') {
    return { label: 'Изменение', color: 'warning' };
  }
  if (changedFields.deleted_at && changedFields.deleted_at.new !== null) {
    return { label: 'Удаление', color: 'negative' };
  }
  const entries = Object.values(changedFields);
  if (entries.length > 0 && entries.every((entry) => entry && entry.old === null)) {
    return { label: 'Создание', color: 'positive' };
  }
  return { label: 'Изменение', color: 'warning' };
}

const AUDIT_FIELD_LABELS = {
  last_name: 'Фамилия',
  first_name: 'Имя',
  middle_name: 'Отчество',
  birth_date: 'Дата рождения',
  passport_series: 'Серия паспорта',
  passport_number: 'Номер паспорта',
  passport_issue_date: 'Дата выдачи паспорта',
  passport_department_code: 'Код подразделения',
  passport_issued_by: 'Кем выдан паспорт',
  reg_region: 'Регион',
  reg_city: 'Город',
  reg_street: 'Улица',
  reg_house: 'Дом',
  reg_building: 'Корпус',
  reg_apartment: 'Квартира',
  file_ids: 'Сканы паспорта (ID)',
  name: 'Наименование',
  comment: 'Комментарий',
  organization_id: 'Организация (ID)',
  parent_id: 'Родительский отдел (ID)',
  employee_id: 'Сотрудник (ID)',
  action_type: 'Тип приказа',
  department_id: 'Отдел (ID)',
  position_id: 'Должность (ID)',
  salary: 'Оклад',
  action_date: 'Дата приказа',
  deleted_at: 'Дата удаления',
};

function formatAuditFieldName(key) {
  return AUDIT_FIELD_LABELS[key] || key;
}

function formatAuditFieldValue(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'action_type') return getActionTypeLabel(val);
  if (key === 'salary') return formatSalary(val);
  if (key === 'deleted_at') return formatDateTime(val);
  if (Array.isArray(val)) return val.length ? `${val.length} файл(ов)` : '—';
  return String(val);
}

// ==================== ЗАГРУЗКА ДАННЫХ С API ====================
async function fetchEmployees() {
  loadingEmployees.value = true;
  try {
    const params = {};
    if (employeeSearch.value && employeeSearch.value.trim()) {
      params.search = employeeSearch.value.trim();
    }
    const { data } = await api.get('/employees', { params });
    employees.value = data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить список сотрудников');
  } finally {
    loadingEmployees.value = false;
  }
}

async function fetchOrganizations() {
  loadingOrgs.value = true;
  try {
    const { data } = await api.get('/organizations');
    organizations.value = data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить организации');
  } finally {
    loadingOrgs.value = false;
  }
}

async function fetchDepartments() {
  loadingDepts.value = true;
  try {
    const { data } = await api.get('/departments');
    departments.value = data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить отделы');
  } finally {
    loadingDepts.value = false;
  }
}

async function fetchPositions() {
  loadingPositions.value = true;
  try {
    const { data } = await api.get('/positions');
    positions.value = data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить должности');
  } finally {
    loadingPositions.value = false;
  }
}

async function fetchAuditLogs() {
  loadingAudit.value = true;
  try {
    const params = { limit: 100, offset: 0 };
    if (auditEntityFilter.value) {
      params.entity_type = auditEntityFilter.value;
    }
    const { data } = await api.get('/audit-logs', { params });
    auditLogs.value = data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить журнал аудита');
  } finally {
    loadingAudit.value = false;
  }
}

function onTabChange(tabName) {
  if (tabName === 'audit') {
    fetchAuditLogs();
  }
}

onMounted(async () => {
  await Promise.all([
    fetchEmployees(),
    fetchOrganizations(),
    fetchDepartments(),
    fetchPositions(),
    fetchAuditLogs(),
  ]);
});

// ==================== CRUD СОТРУДНИКОВ ====================
const employeeDialog = ref(false);
const editingEmployeeId = ref(null);
const savingEmployee = ref(false);
const uploadingFiles = ref(false);
const selectedUploadFiles = ref([]);
const attachedFiles = ref([]);

function createEmptyEmployeeForm() {
  return {
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
  };
}

const employeeForm = ref(createEmptyEmployeeForm());

function openCreateEmployeeDialog() {
  editingEmployeeId.value = null;
  employeeForm.value = createEmptyEmployeeForm();
  selectedUploadFiles.value = [];
  attachedFiles.value = [];
  employeeDialog.value = true;
}

async function openEditEmployeeDialog(empRow) {
  try {
    const { data } = await api.get(`/employees/${empRow.id}`);
    editingEmployeeId.value = data.id;
    employeeForm.value = {
      last_name: data.last_name || '',
      first_name: data.first_name || '',
      middle_name: data.middle_name || '',
      birth_date: data.birth_date ? String(data.birth_date).slice(0, 10) : '',
      passport_series: data.passport_series || '',
      passport_number: data.passport_number || '',
      passport_issue_date: data.passport_issue_date
        ? String(data.passport_issue_date).slice(0, 10)
        : '',
      passport_department_code: data.passport_department_code || '',
      passport_issued_by: data.passport_issued_by || '',
      reg_region: data.reg_region || '',
      reg_city: data.reg_city || '',
      reg_street: data.reg_street || '',
      reg_house: data.reg_house || '',
      reg_building: data.reg_building || '',
      reg_apartment: data.reg_apartment || '',
    };
    selectedUploadFiles.value = [];
    attachedFiles.value = Array.isArray(data.passport_files)
      ? [...data.passport_files]
      : [];
    employeeDialog.value = true;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить анкету сотрудника');
  }
}

async function handleFilesUpload(files) {
  if (!files || files.length === 0) return;

  uploadingFiles.value = true;
  try {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const { data } = await api.post('/files/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    attachedFiles.value.push(...data);
    selectedUploadFiles.value = [];
    notifySuccess(`Загружено файлов: ${data.length}`);
  } catch (err) {
    notifyError(err, 'Ошибка при загрузке файлов сканов');
  } finally {
    uploadingFiles.value = false;
  }
}

function removeAttachedFile(fileId) {
  attachedFiles.value = attachedFiles.value.filter((f) => f.id !== fileId);
}

async function saveEmployee() {
  savingEmployee.value = true;
  try {
    const payload = {
      ...employeeForm.value,
      middle_name: employeeForm.value.middle_name?.trim() || null,
      reg_building: employeeForm.value.reg_building?.trim() || null,
      reg_apartment: employeeForm.value.reg_apartment?.trim() || null,
      file_ids: attachedFiles.value.map((f) => f.id),
    };

    if (editingEmployeeId.value) {
      await api.put(`/employees/${editingEmployeeId.value}`, payload);
      notifySuccess('Данные сотрудника обновлены');
    } else {
      await api.post('/employees', payload);
      notifySuccess('Сотрудник успешно добавлен');
    }

    employeeDialog.value = false;
    await Promise.all([fetchEmployees(), fetchAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка при сохранении сотрудника');
  } finally {
    savingEmployee.value = false;
  }
}

function confirmDeleteEmployee(emp) {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Вы действительно хотите удалить сотрудника «${formatFullName(emp)}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/employees/${emp.id}`);
      notifySuccess('Сотрудник помечен как удаленный');
      await Promise.all([fetchEmployees(), fetchAuditLogs()]);
    } catch (err) {
      notifyError(err, 'Не удалось удалить сотрудника');
    }
  });
}

// ==================== ЛИЧНОЕ ДЕЛО И КАДРОВЫЕ ПРИКАЗЫ ====================
const detailsDialog = ref(false);
const selectedEmployee = ref(null);
const employeeActions = ref([]);
const loadingEmployeeActions = ref(false);

async function openEmployeeDetails(empRow) {
  detailsDialog.value = true;
  loadingEmployeeActions.value = true;
  try {
    const [empRes, actionsRes] = await Promise.all([
      api.get(`/employees/${empRow.id}`),
      api.get(`/personnel-actions/employee/${empRow.id}`),
    ]);
    selectedEmployee.value = empRes.data;
    employeeActions.value = actionsRes.data;
  } catch (err) {
    notifyError(err, 'Не удалось загрузить личное дело сотрудника');
  } finally {
    loadingEmployeeActions.value = false;
  }
}

const actionDialog = ref(false);
const actionTargetEmployee = ref(null);
const savingAction = ref(false);
const actionForm = ref({
  action_type: 'hire',
  department_id: null,
  position_id: null,
  salary: null,
  action_date: getTodayIsoDate(),
});

const availableActionTypes = computed(() => {
  const status = actionTargetEmployee.value?.employment_status;
  if (status === 'employed') {
    return [
      { label: 'Кадровый перевод (отдел / должность)', value: 'transfer_dept' },
      { label: 'Изменение оклада', value: 'change_salary' },
      { label: 'Увольнение', value: 'fire' },
    ];
  }
  return [{ label: 'Прием на работу', value: 'hire' }];
});

function openActionDialog(emp) {
  actionTargetEmployee.value = emp;
  const isEmployed = emp.employment_status === 'employed';
  actionForm.value = {
    action_type: isEmployed ? 'transfer_dept' : 'hire',
    department_id: isEmployed ? emp.current_department_id || null : null,
    position_id: isEmployed ? emp.current_position_id || null : null,
    salary: isEmployed && emp.current_salary ? Number(emp.current_salary) : null,
    action_date: getTodayIsoDate(),
  };
  actionDialog.value = true;
}

async function submitPersonnelAction() {
  if (!actionTargetEmployee.value) return;

  savingAction.value = true;
  try {
    const type = actionForm.value.action_type;
    const payload = {
      employee_id: actionTargetEmployee.value.id,
      action_type: type,
      action_date: actionForm.value.action_date,
    };

    if (type === 'hire' || type === 'transfer_dept') {
      payload.department_id = actionForm.value.department_id;
      payload.position_id = actionForm.value.position_id;
    }
    if (type === 'hire' || type === 'change_salary') {
      payload.salary = Number(actionForm.value.salary);
    }

    await api.post('/personnel-actions', payload);
    notifySuccess('Кадровый приказ успешно проведен');
    actionDialog.value = false;

    await Promise.all([fetchEmployees(), fetchAuditLogs()]);
    if (detailsDialog.value && selectedEmployee.value) {
      await openEmployeeDetails(selectedEmployee.value);
    }
  } catch (err) {
    notifyError(err, 'Ошибка при проведении кадрового приказа');
  } finally {
    savingAction.value = false;
  }
}

function confirmDeletePersonnelAction(act) {
  $q.dialog({
    title: 'Отмена кадрового приказа',
    message: `Отменить приказ «${getActionTypeLabel(act.action_type)}» от ${formatDate(
      act.action_date,
    )}?`,
    cancel: { label: 'Нет', flat: true },
    ok: { label: 'Отменить приказ', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/personnel-actions/${act.id}`);
      notifySuccess('Кадровый приказ отменен');
      await Promise.all([fetchEmployees(), fetchAuditLogs()]);
      if (selectedEmployee.value) {
        await openEmployeeDetails(selectedEmployee.value);
      }
    } catch (err) {
      notifyError(err, 'Не удалось отменить кадровый приказ');
    }
  });
}

// ==================== CRUD ОРГАНИЗАЦИЙ ====================
const orgDialog = ref(false);
const editingOrgId = ref(null);
const savingOrg = ref(false);
const orgForm = ref({ name: '', comment: '' });

function openCreateOrgDialog() {
  editingOrgId.value = null;
  orgForm.value = { name: '', comment: '' };
  orgDialog.value = true;
}

function openEditOrgDialog(org) {
  editingOrgId.value = org.id;
  orgForm.value = { name: org.name, comment: org.comment || '' };
  orgDialog.value = true;
}

async function saveOrg() {
  savingOrg.value = true;
  try {
    const payload = {
      name: orgForm.value.name.trim(),
      comment: orgForm.value.comment?.trim() || null,
    };
    if (editingOrgId.value) {
      await api.put(`/organizations/${editingOrgId.value}`, payload);
      notifySuccess('Организация обновлена');
    } else {
      await api.post('/organizations', payload);
      notifySuccess('Организация создана');
    }
    orgDialog.value = false;
    await Promise.all([fetchOrganizations(), fetchDepartments(), fetchAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка при сохранении организации');
  } finally {
    savingOrg.value = false;
  }
}

function confirmDeleteOrg(org) {
  $q.dialog({
    title: 'Удаление организации',
    message: `Удалить организацию «${org.name}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/organizations/${org.id}`);
      notifySuccess('Организация удалена');
      await Promise.all([fetchOrganizations(), fetchAuditLogs()]);
    } catch (err) {
      notifyError(err, 'Не удалось удалить организацию');
    }
  });
}

// ==================== CRUD ОТДЕЛОВ ====================
const deptDialog = ref(false);
const editingDeptId = ref(null);
const savingDept = ref(false);
const deptForm = ref({
  organization_id: null,
  parent_id: null,
  name: '',
  comment: '',
});

function openCreateDeptDialog() {
  editingDeptId.value = null;
  deptForm.value = {
    organization_id: activeOrganizations.value[0]?.id || null,
    parent_id: null,
    name: '',
    comment: '',
  };
  deptDialog.value = true;
}

function openEditDeptDialog(dept) {
  editingDeptId.value = dept.id;
  deptForm.value = {
    organization_id: dept.organization_id,
    parent_id: dept.parent_id || null,
    name: dept.name,
    comment: dept.comment || '',
  };
  deptDialog.value = true;
}

async function saveDept() {
  savingDept.value = true;
  try {
    const payload = {
      organization_id: deptForm.value.organization_id,
      parent_id: deptForm.value.parent_id || null,
      name: deptForm.value.name.trim(),
      comment: deptForm.value.comment?.trim() || null,
    };
    if (editingDeptId.value) {
      await api.put(`/departments/${editingDeptId.value}`, payload);
      notifySuccess('Отдел обновлен');
    } else {
      await api.post('/departments', payload);
      notifySuccess('Отдел создан');
    }
    deptDialog.value = false;
    await Promise.all([fetchDepartments(), fetchAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка при сохранении отдела');
  } finally {
    savingDept.value = false;
  }
}

function confirmDeleteDept(dept) {
  $q.dialog({
    title: 'Удаление отдела',
    message: `Удалить отдел «${dept.name}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/departments/${dept.id}`);
      notifySuccess('Отдел удален');
      await Promise.all([fetchDepartments(), fetchAuditLogs()]);
    } catch (err) {
      notifyError(err, 'Не удалось удалить отдел');
    }
  });
}

// ==================== CRUD ДОЛЖНОСТЕЙ ====================
const positionDialog = ref(false);
const editingPositionId = ref(null);
const savingPosition = ref(false);
const positionForm = ref({ name: '' });

function openCreatePositionDialog() {
  editingPositionId.value = null;
  positionForm.value = { name: '' };
  positionDialog.value = true;
}

function openEditPositionDialog(pos) {
  editingPositionId.value = pos.id;
  positionForm.value = { name: pos.name };
  positionDialog.value = true;
}

async function savePosition() {
  savingPosition.value = true;
  try {
    const payload = { name: positionForm.value.name.trim() };
    if (editingPositionId.value) {
      await api.put(`/positions/${editingPositionId.value}`, payload);
      notifySuccess('Должность обновлена');
    } else {
      await api.post('/positions', payload);
      notifySuccess('Должность создана');
    }
    positionDialog.value = false;
    await Promise.all([fetchPositions(), fetchAuditLogs()]);
  } catch (err) {
    notifyError(err, 'Ошибка при сохранении должности');
  } finally {
    savingPosition.value = false;
  }
}

function confirmDeletePosition(pos) {
  $q.dialog({
    title: 'Удаление должности',
    message: `Удалить должность «${pos.name}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/positions/${pos.id}`);
      notifySuccess('Должность удалена');
      await Promise.all([fetchPositions(), fetchAuditLogs()]);
    } catch (err) {
      notifyError(err, 'Не удалось удалить должность');
    }
  });
}
</script>