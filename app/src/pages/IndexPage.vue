<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="text-h5 text-weight-bold">Areal HR</div>
        <div class="text-caption text-grey-7">Система управления кадрами и организационной структурой</div>
      </div>
      <q-badge color="primary" class="q-pa-sm text-subtitle2">Неделя 4: Кадровые операции</q-badge>
    </div>

    <!-- Вкладки навигации -->
    <q-tabs
      v-model="activeTab"
      dense
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
      align="left"
      narrow-indicator
    >
      <q-tab name="employees" icon="badge" label="Сотрудники" />
      <q-tab name="organizations" icon="business" label="Организации" />
      <q-tab name="departments" icon="account_tree" label="Отделы" />
      <q-tab name="positions" icon="work" label="Должности" />
    </q-tabs>

    <q-separator class="q-mb-md" />

    <!-- ВКЛАДКА: СОТРУДНИКИ -->
    <div v-if="activeTab === 'employees'">
      <div class="row q-gutter-md q-mb-md items-center justify-between">
        <div class="row q-gutter-sm items-center col-12 col-md-6">
          <q-input
            v-model="empSearch"
            dense
            outlined
            placeholder="Поиск по ФИО или номеру паспорта..."
            class="col"
            @update:model-value="onSearchInput"
            clearable
          >
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
          <q-btn flat round icon="refresh" @click="loadEmployees" />
        </div>
        <q-btn
          color="primary"
          icon="person_add"
          label="Добавить сотрудника"
          @click="openAddEmployeeDialog"
        />
      </div>

      <q-table
        :rows="employees"
        :columns="employeeColumns"
        row-key="id"
        flat
        bordered
        :loading="loadingEmployees"
        no-data-label="Сотрудники не найдены"
      >
        <!-- ФИО -->
        <template v-slot:body-cell-fio="props">
          <q-td :props="props">
            <div class="text-weight-bold">
              {{ props.row.last_name }} {{ props.row.first_name }} {{ props.row.middle_name || '' }}
            </div>
            <div class="text-caption text-grey-6">
              Паспорт: {{ props.row.passport_series }} {{ props.row.passport_number }}
            </div>
          </q-td>
        </template>

        <!-- Кадровый статус -->
        <template v-slot:body-cell-job="props">
          <q-td :props="props">
            <div v-if="props.row.employment_status === 'employed'">
              <div class="text-weight-medium text-primary">{{ props.row.current_position_name || '—' }}</div>
              <div class="text-caption text-grey-7">{{ props.row.current_department_name || '—' }}</div>
              <div class="text-caption text-weight-bold text-positive">
                {{ formatMoney(props.row.current_salary) }}
              </div>
            </div>
            <div v-else-if="props.row.employment_status === 'fired'">
              <q-badge color="negative" label="Уволен" />
              <div class="text-caption text-grey-6">Дата: {{ props.row.last_action_date }}</div>
            </div>
            <div v-else>
              <q-badge color="warning" text-color="black" label="Не трудоустроен" />
            </div>
          </q-td>
        </template>

        <!-- Сканы -->
        <template v-slot:body-cell-files_count="props">
          <q-td :props="props" align="center">
            <q-badge color="indigo" :label="`${props.row.files_count || 0} файл(ов)`" />
          </q-td>
        </template>

        <!-- Статус активности -->
        <template v-slot:body-cell-status="props">
          <q-td :props="props" align="center">
            <q-badge v-if="props.row.deleted_at" color="negative" label="Удален" />
            <q-badge v-else color="positive" label="Активен" />
          </q-td>
        </template>

        <!-- Действия -->
        <template v-slot:body-cell-actions="props">
          <q-td :props="props" align="center">
            <q-btn
              flat
              dense
              round
              icon="assignment"
              color="indigo"
              :disable="!!props.row.deleted_at"
              @click="openPersonnelActionDialog(props.row)"
            >
              <q-tooltip>Кадровый приказ</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="visibility"
              color="primary"
              @click="openViewEmployee(props.row)"
            >
              <q-tooltip>Карточка и история</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="edit"
              :disable="!!props.row.deleted_at"
              @click="openEditEmployeeDialog(props.row)"
            >
              <q-tooltip>Редактировать анкету</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="delete"
              color="negative"
              :disable="!!props.row.deleted_at"
              @click="confirmDeleteEmployee(props.row)"
            >
              <q-tooltip>Удалить</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

    <!-- ВКЛАДКА: ОРГАНИЗАЦИИ -->
    <div v-else-if="activeTab === 'organizations'">
      <div class="row justify-end q-mb-md">
        <q-btn color="primary" icon="add" label="Добавить организацию" @click="openOrgDialog()" />
      </div>
      <q-table :rows="organizations" :columns="orgColumns" row-key="id" flat bordered>
        <template v-slot:body-cell-status="props">
          <q-td :props="props" align="center">
            <q-badge v-if="props.row.deleted_at" color="negative" label="Удален" />
            <q-badge v-else color="positive" label="Активен" />
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props" align="center">
            <q-btn flat dense round icon="edit" :disable="!!props.row.deleted_at" @click="openOrgDialog(props.row)" />
            <q-btn flat dense round icon="delete" color="negative" :disable="!!props.row.deleted_at" @click="deleteOrg(props.row)" />
          </q-td>
        </template>
      </q-table>
    </div>

    <!-- ВКЛАДКА: ОТДЕЛЫ -->
    <div v-else-if="activeTab === 'departments'">
      <div class="row justify-end q-mb-md">
        <q-btn color="primary" icon="add" label="Добавить отдел" @click="openDeptDialog()" />
      </div>
      <q-table :rows="departments" :columns="deptColumns" row-key="id" flat bordered>
        <template v-slot:body-cell-status="props">
          <q-td :props="props" align="center">
            <q-badge v-if="props.row.deleted_at" color="negative" label="Удален" />
            <q-badge v-else color="positive" label="Активен" />
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props" align="center">
            <q-btn flat dense round icon="edit" :disable="!!props.row.deleted_at" @click="openDeptDialog(props.row)" />
            <q-btn flat dense round icon="delete" color="negative" :disable="!!props.row.deleted_at" @click="deleteDept(props.row)" />
          </q-td>
        </template>
      </q-table>
    </div>

    <!-- ВКЛАДКА: ДОЛЖНОСТИ -->
    <div v-else-if="activeTab === 'positions'">
      <div class="row justify-end q-mb-md">
        <q-btn color="primary" icon="add" label="Добавить должность" @click="openPosDialog()" />
      </div>
      <q-table :rows="positions" :columns="posColumns" row-key="id" flat bordered>
        <template v-slot:body-cell-status="props">
          <q-td :props="props" align="center">
            <q-badge v-if="props.row.deleted_at" color="negative" label="Удален" />
            <q-badge v-else color="positive" label="Активен" />
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props" align="center">
            <q-btn flat dense round icon="edit" :disable="!!props.row.deleted_at" @click="openPosDialog(props.row)" />
            <q-btn flat dense round icon="delete" color="negative" :disable="!!props.row.deleted_at" @click="deletePos(props.row)" />
          </q-td>
        </template>
      </q-table>
    </div>

    <!-- ДИАЛОГ: КАДРОВЫЙ ПРИКАЗ -->
    <q-dialog v-model="paDialog.show" persistent>
      <q-card style="width: 550px; max-width: 95vw;">
        <q-card-section class="bg-primary text-white row items-center justify-between">
          <div class="text-h6">Кадровый приказ</div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-md">
          <div class="text-subtitle1 text-weight-bold q-mb-xs">
            {{ paDialog.employee?.last_name }} {{ paDialog.employee?.first_name }}
          </div>
          <div class="text-caption text-grey-7 q-mb-md">
            Текущий статус: 
            <span class="text-weight-bold">{{ getStatusLabel(paDialog.employee?.employment_status) }}</span>
          </div>

          <q-form @submit="submitPersonnelAction" class="q-gutter-md">
            <q-select
              v-model="paForm.action_type"
              :options="availableActionTypes"
              emit-value
              map-options
              label="Тип приказа *"
              outlined
              dense
              :rules="[val => !!val || 'Выберите тип кадрового события']"
            />

            <!-- Выбор подразделения -->
            <q-select
              v-if="paForm.action_type === 'hire' || paForm.action_type === 'transfer_dept'"
              v-model="paForm.department_id"
              :options="activeDepartments"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Подразделение *"
              outlined
              dense
              :rules="[val => !!val || 'Подразделение обязательно']"
            />

            <!-- Выбор должности -->
            <q-select
              v-if="paForm.action_type === 'hire' || paForm.action_type === 'transfer_dept'"
              v-model="paForm.position_id"
              :options="activePositions"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Должность *"
              outlined
              dense
              :rules="[val => !!val || 'Должность обязательна']"
            />

            <!-- Оклад -->
            <q-input
              v-if="paForm.action_type === 'hire' || paForm.action_type === 'change_salary' || paForm.action_type === 'transfer_dept'"
              v-model.number="paForm.salary"
              type="number"
              label="Оклад (руб.) *"
              outlined
              dense
              prefix="₽"
              :rules="[
                val => (paForm.action_type !== 'transfer_dept' ? !!val : true) || 'Оклад обязателен',
                val => !val || val > 0 || 'Оклад должен быть больше нуля'
              ]"
            />

            <!-- Дата события -->
            <q-input
              v-model="paForm.action_date"
              label="Дата приказа (ГГГГ-ММ-ДД) *"
              outlined
              dense
              mask="####-##-##"
              :rules="[val => !!val || 'Дата приказа обязательна']"
            >
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="paForm.action_date" mask="YYYY-MM-DD">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="ОК" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>

            <div class="row justify-end q-gutter-sm q-mt-lg">
              <q-btn flat label="Отмена" v-close-popup />
              <q-btn color="primary" label="Провести приказ" type="submit" :loading="paDialog.saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- ДИАЛОГ: КАРТОЧКА СОТРУДНИКА И ИСТОРИЯ ПЕРЕМЕЩЕНИЙ -->
    <q-dialog v-model="viewDialog.show" full-width>
      <q-card>
        <q-card-section class="bg-indigo text-white row items-center justify-between">
          <div class="text-h6">Личное дело сотрудника</div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section v-if="viewDialog.employee" class="q-pa-md">
          <div class="row q-col-gutter-md">
            <!-- Левая колонка: анкетные данные -->
            <div class="col-12 col-md-5">
              <div class="text-h6 text-weight-bold">
                {{ viewDialog.employee.last_name }} {{ viewDialog.employee.first_name }} {{ viewDialog.employee.middle_name || '' }}
              </div>
              <div class="q-mt-sm">
                <b>Дата рождения:</b> {{ viewDialog.employee.birth_date }}
              </div>
              <div class="q-mt-sm">
                <b>Паспорт:</b> серия {{ viewDialog.employee.passport_series }} № {{ viewDialog.employee.passport_number }}
              </div>
              <div class="q-mt-xs"><b>Выдан:</b> {{ viewDialog.employee.passport_issued_by }} (код: {{ viewDialog.employee.passport_department_code }})</div>
              <div class="q-mt-xs"><b>Дата выдачи:</b> {{ viewDialog.employee.passport_issue_date }}</div>
              <div class="q-mt-sm">
                <b>Адрес регистрации:</b> 
                {{ viewDialog.employee.reg_region }}, г. {{ viewDialog.employee.reg_city }}, ул. {{ viewDialog.employee.reg_street }}, д. {{ viewDialog.employee.reg_house }}
                <span v-if="viewDialog.employee.reg_apartment">, кв. {{ viewDialog.employee.reg_apartment }}</span>
              </div>

              <q-separator class="q-my-md" />

              <div class="text-subtitle2 text-weight-bold q-mb-sm">Сканы документов ({{ viewDialog.employee.passport_files?.length || 0 }}):</div>
              <q-list bordered separator dense v-if="viewDialog.employee.passport_files?.length">
                <q-item v-for="file in viewDialog.employee.passport_files" :key="file.id">
                  <q-item-section avatar>
                    <q-icon name="description" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="ellipsis">{{ file.name }}</q-item-label>
                    <q-item-label caption>{{ (file.size / 1024).toFixed(1) }} КБ</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat round dense icon="download" color="primary" :href="`${apiBaseUrl}/files/${file.id}/download`" target="_blank" />
                  </q-item-section>
                </q-item>
              </q-list>
              <div v-else class="text-caption text-grey-6">Файлы не прикреплены</div>
            </div>

            <!-- Правая колонка: Хронология кадровых перемещений -->
            <div class="col-12 col-md-7">
              <div class="text-h6 text-weight-bold q-mb-sm">История кадровых приказов</div>
              <div v-if="viewDialog.loadingHistory" class="text-center q-pa-md">
                <q-spinner color="primary" size="30px" />
              </div>
              <q-timeline color="secondary" v-else-if="viewDialog.history.length">
                <q-timeline-entry
                  v-for="action in viewDialog.history"
                  :key="action.id"
                  :title="getActionTypeLabel(action.action_type)"
                  :subtitle="action.action_date"
                  :icon="getActionIcon(action.action_type)"
                  :color="getActionColor(action.action_type)"
                >
                  <div v-if="action.action_type !== 'fire'">
                    <div><b>Подразделение:</b> {{ action.department_name || '—' }} ({{ action.organization_name || '—' }})</div>
                    <div><b>Должность:</b> {{ action.position_name || '—' }}</div>
                    <div v-if="action.salary"><b>Оклад:</b> {{ formatMoney(action.salary) }}</div>
                  </div>
                  <div v-else class="text-negative text-weight-medium">
                    Трудовой договор расторгнут.
                  </div>
                </q-timeline-entry>
              </q-timeline>
              <div v-else class="text-grey-6 q-pa-md text-center">
                Кадровые приказы по данному сотруднику еще не проводились
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- ДИАЛОГ: СОЗДАНИЕ / РЕДАКТИРОВАНИЕ СОТРУДНИКА -->
    <q-dialog v-model="empDialog.show" persistent>
      <q-card style="width: 750px; max-width: 95vw;">
        <q-card-section class="bg-primary text-white row items-center justify-between">
          <div class="text-h6">{{ empDialog.isEdit ? 'Редактирование сотрудника' : 'Новый сотрудник' }}</div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section class="q-pa-md">
          <q-form @submit="saveEmployee" class="q-gutter-sm">
            <div class="text-subtitle2 text-weight-bold text-primary">1. Личные данные</div>
            <div class="row q-col-gutter-sm">
              <q-input v-model="empForm.last_name" label="Фамилия *" outlined dense class="col-12 col-md-4" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.first_name" label="Имя *" outlined dense class="col-12 col-md-4" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.middle_name" label="Отчество" outlined dense class="col-12 col-md-4" />
              <q-input v-model="empForm.birth_date" label="Дата рождения (ГГГГ-ММ-ДД) *" outlined dense mask="####-##-##" class="col-12 col-md-4" :rules="[val => !!val || 'Обязательно']" />
            </div>

            <div class="text-subtitle2 text-weight-bold text-primary q-mt-md">2. Паспортные данные</div>
            <div class="row q-col-gutter-sm">
              <q-input v-model="empForm.passport_series" label="Серия (4 цифры) *" outlined dense mask="####" class="col-12 col-md-3" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.passport_number" label="Номер (6 цифр) *" outlined dense mask="######" class="col-12 col-md-3" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.passport_issue_date" label="Дата выдачи (ГГГГ-ММ-ДД) *" outlined dense mask="####-##-##" class="col-12 col-md-3" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.passport_department_code" label="Код подразделения *" outlined dense mask="###-###" class="col-12 col-md-3" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.passport_issued_by" label="Кем выдан *" outlined dense class="col-12" :rules="[val => !!val || 'Обязательно']" />
            </div>

            <div class="text-subtitle2 text-weight-bold text-primary q-mt-md">3. Адрес регистрации</div>
            <div class="row q-col-gutter-sm">
              <q-input v-model="empForm.reg_region" label="Регион *" outlined dense class="col-12 col-md-6" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.reg_city" label="Город / НП *" outlined dense class="col-12 col-md-6" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.reg_street" label="Улица *" outlined dense class="col-12 col-md-6" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.reg_house" label="Дом *" outlined dense class="col-12 col-md-2" :rules="[val => !!val || 'Обязательно']" />
              <q-input v-model="empForm.reg_building" label="Корпус" outlined dense class="col-12 col-md-2" />
              <q-input v-model="empForm.reg_apartment" label="Квартира" outlined dense class="col-12 col-md-2" />
            </div>

            <div class="text-subtitle2 text-weight-bold text-primary q-mt-md">4. Сканы паспорта</div>
            <q-file
              v-model="uploadedFiles"
              label="Загрузить сканы (JPG, PNG, PDF)"
              outlined
              dense
              multiple
              append
              use-chips
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              @update:model-value="uploadScans"
            >
              <template v-slot:prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>

            <div class="row justify-end q-gutter-sm q-mt-lg">
              <q-btn flat label="Отмена" v-close-popup />
              <q-btn color="primary" label="Сохранить" type="submit" :loading="empDialog.saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- ДИАЛОГИ ОРГАНИЗАЦИЙ, ОТДЕЛОВ, ДОЛЖНОСТЕЙ -->
    <q-dialog v-model="simpleDialog.show" persistent>
      <q-card style="width: 450px; max-width: 90vw;">
        <q-card-section class="bg-primary text-white row items-center justify-between">
          <div class="text-h6">{{ simpleDialog.title }}</div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <q-form @submit="submitSimpleForm" class="q-gutter-md">
            <q-input v-model="simpleDialog.name" label="Наименование *" outlined dense :rules="[val => !!val || 'Обязательно']" />
            
            <q-select
              v-if="simpleDialog.type === 'dept'"
              v-model="simpleDialog.organization_id"
              :options="organizations.filter(o => !o.deleted_at)"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Организация *"
              outlined
              dense
              :rules="[val => !!val || 'Обязательно']"
            />

            <q-select
              v-if="simpleDialog.type === 'dept'"
              v-model="simpleDialog.parent_id"
              :options="getAvailableParents()"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Родительский отдел"
              outlined
              dense
              clearable
            />

            <q-input
              v-if="simpleDialog.type !== 'pos'"
              v-model="simpleDialog.comment"
              label="Комментарий"
              outlined
              dense
              type="textarea"
            />

            <div class="row justify-end q-gutter-sm">
              <q-btn flat label="Отмена" v-close-popup />
              <q-btn color="primary" label="Сохранить" type="submit" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../boot/axios';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const apiBaseUrl = api.defaults.baseURL || 'http://localhost:3000';

const activeTab = ref('employees');
const employees = ref([]);
const organizations = ref([]);
const departments = ref([]);
const positions = ref([]);
const loadingEmployees = ref(false);
const empSearch = ref('');
let searchTimer = null;

// Колонки таблицы сотрудников
const employeeColumns = [
  { name: 'fio', label: 'Сотрудник', align: 'left', sortable: true },
  { name: 'birth_date', label: 'Дата рожд.', field: 'birth_date', align: 'center', sortable: true },
  { name: 'job', label: 'Кадровое состояние', align: 'left' },
  { name: 'files_count', label: 'Сканы', field: 'files_count', align: 'center' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center', sortable: true },
  { name: 'actions', label: 'Действия', align: 'center' },
];

const orgColumns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'comment', label: 'Комментарий', field: 'comment', align: 'left' },
  { name: 'status', label: 'Статус', align: 'center' },
  { name: 'actions', label: 'Действия', align: 'center' },
];

const deptColumns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'org', label: 'Организация', field: 'organization_name', align: 'left' },
  { name: 'parent', label: 'Вышестоящий отдел', field: 'parent_name', align: 'left' },
  { name: 'status', label: 'Статус', align: 'center' },
  { name: 'actions', label: 'Действия', align: 'center' },
];

const posColumns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'status', label: 'Статус', align: 'center' },
  { name: 'actions', label: 'Действия', align: 'center' },
];

// Диалог кадрового приказа
const paDialog = ref({
  show: false,
  employee: null,
  saving: false,
});

const paForm = ref({
  action_type: 'hire',
  department_id: null,
  position_id: null,
  salary: null,
  action_date: new Date().toISOString().substring(0, 10),
});

// Доступные типы кадровых приказов в зависимости от статуса сотрудника
const availableActionTypes = computed(() => {
  const status = paDialog.value.employee?.employment_status;
  if (status === 'employed') {
    return [
      { label: 'Кадровый перевод (смена отдела/должности)', value: 'transfer_dept' },
      { label: 'Изменение оклада', value: 'change_salary' },
      { label: 'Увольнение', value: 'fire' },
    ];
  }
  return [{ label: 'Прием на работу', value: 'hire' }];
});

const activeDepartments = computed(() => departments.value.filter(d => !d.deleted_at));
const activePositions = computed(() => positions.value.filter(p => !p.deleted_at));

// Просмотр карточки и истории
const viewDialog = ref({
  show: false,
  employee: null,
  history: [],
  loadingHistory: false,
});

// Форма сотрудника
const empDialog = ref({ show: false, isEdit: false, id: null, saving: false });
const empForm = ref({
  last_name: '', first_name: '', middle_name: '', birth_date: '',
  passport_series: '', passport_number: '', passport_issue_date: '',
  passport_department_code: '', passport_issued_by: '',
  reg_region: '', reg_city: '', reg_street: '', reg_house: '',
  reg_building: '', reg_apartment: '', file_ids: [],
});
const uploadedFiles = ref([]);

// Справочники dialog
const simpleDialog = ref({
  show: false, type: 'org', isEdit: false, id: null,
  title: '', name: '', comment: '', organization_id: null, parent_id: null,
});

// Загрузка списков
const loadEmployees = async () => {
  loadingEmployees.value = true;
  try {
    const res = await api.get('/employees', { params: { search: empSearch.value || undefined } });
    employees.value = res.data;
  } catch (err) {
    showError(err);
  } finally {
    loadingEmployees.value = false;
  }
};

const loadReferences = async () => {
  try {
    const [oRes, dRes, pRes] = await Promise.all([
      api.get('/organizations'),
      api.get('/departments'),
      api.get('/positions'),
    ]);
    organizations.value = oRes.data;
    departments.value = dRes.data;
    positions.value = pRes.data;
  } catch (err) {
    showError(err);
  }
};

const onSearchInput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadEmployees, 300);
};

// Открытие диалога кадрового приказа
const openPersonnelActionDialog = (emp) => {
  paDialog.value.employee = emp;
  const isEmployed = emp.employment_status === 'employed';
  paForm.value = {
    action_type: isEmployed ? 'transfer_dept' : 'hire',
    department_id: isEmployed ? emp.current_department_id : null,
    position_id: isEmployed ? emp.current_position_id : null,
    salary: isEmployed ? emp.current_salary : null,
    action_date: new Date().toISOString().substring(0, 10),
  };
  paDialog.value.show = true;
};

const submitPersonnelAction = async () => {
  paDialog.value.saving = true;
  try {
    await api.post('/personnel-actions', {
      employee_id: paDialog.value.employee.id,
      ...paForm.value,
    });
    $q.notify({ type: 'positive', message: 'Кадровый приказ успешно проведен' });
    paDialog.value.show = false;
    loadEmployees();
  } catch (err) {
    showError(err);
  } finally {
    paDialog.value.saving = false;
  }
};

// Открытие карточки
const openViewEmployee = async (emp) => {
  viewDialog.value.show = true;
  viewDialog.value.loadingHistory = true;
  try {
    const [empRes, histRes] = await Promise.all([
      api.get(`/employees/${emp.id}`),
      api.get(`/personnel-actions/employee/${emp.id}`),
    ]);
    viewDialog.value.employee = empRes.data;
    viewDialog.value.history = histRes.data;
  } catch (err) {
    showError(err);
  } finally {
    viewDialog.value.loadingHistory = false;
  }
};

// Работа с файлами
const uploadScans = async (files) => {
  if (!files || !files.length) return;
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  try {
    const res = await api.post('/files/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const ids = res.data.map(item => item.id);
    empForm.value.file_ids.push(...ids);
    $q.notify({ type: 'positive', message: `Успешно загружено ${ids.length} файл(ов)` });
  } catch (err) {
    showError(err);
  }
};

// CRUD Сотрудники
const openAddEmployeeDialog = () => {
  empDialog.value = { show: true, isEdit: false, id: null, saving: false };
  uploadedFiles.value = [];
  empForm.value = {
    last_name: '', first_name: '', middle_name: '', birth_date: '',
    passport_series: '', passport_number: '', passport_issue_date: '',
    passport_department_code: '', passport_issued_by: '',
    reg_region: '', reg_city: '', reg_street: '', reg_house: '',
    reg_building: '', reg_apartment: '', file_ids: [],
  };
};

const openEditEmployeeDialog = async (emp) => {
  try {
    const res = await api.get(`/employees/${emp.id}`);
    const data = res.data;
    empDialog.value = { show: true, isEdit: true, id: emp.id, saving: false };
    uploadedFiles.value = [];
    empForm.value = {
      ...data,
      file_ids: data.passport_files ? data.passport_files.map(f => f.id) : [],
    };
  } catch (err) {
    showError(err);
  }
};

const saveEmployee = async () => {
  empDialog.value.saving = true;
  try {
    if (empDialog.value.isEdit) {
      await api.put(`/employees/${empDialog.value.id}`, empForm.value);
      $q.notify({ type: 'positive', message: 'Анкета сотрудника обновлена' });
    } else {
      await api.post('/employees', empForm.value);
      $q.notify({ type: 'positive', message: 'Сотрудник успешно создан' });
    }
    empDialog.value.show = false;
    loadEmployees();
  } catch (err) {
    showError(err);
  } finally {
    empDialog.value.saving = false;
  }
};

const confirmDeleteEmployee = (emp) => {
  $q.dialog({
    title: 'Удаление сотрудника',
    message: `Пометить сотрудника «${emp.last_name} ${emp.first_name}» как удаленного?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/employees/${emp.id}`);
      $q.notify({ type: 'positive', message: 'Сотрудник помечен как удаленный' });
      loadEmployees();
    } catch (err) {
      showError(err);
    }
  });
};

// CRUD Справочники
const openOrgDialog = (row) => {
  simpleDialog.value = {
    show: true, type: 'org', isEdit: !!row, id: row?.id || null,
    title: row ? 'Редактировать организацию' : 'Новая организация',
    name: row?.name || '', comment: row?.comment || '',
  };
};

const deleteOrg = (row) => {
  $q.dialog({ title: 'Удаление', message: `Удалить организацию ${row.name}?`, cancel: true }).onOk(async () => {
    try {
      await api.delete(`/organizations/${row.id}`);
      loadReferences();
    } catch (err) { showError(err); }
  });
};

const openDeptDialog = (row) => {
  simpleDialog.value = {
    show: true, type: 'dept', isEdit: !!row, id: row?.id || null,
    title: row ? 'Редактировать отдел' : 'Новый отдел',
    name: row?.name || '', comment: row?.comment || '',
    organization_id: row?.organization_id || null, parent_id: row?.parent_id || null,
  };
};

const deleteDept = (row) => {
  $q.dialog({ title: 'Удаление', message: `Удалить отдел ${row.name}?`, cancel: true }).onOk(async () => {
    try {
      await api.delete(`/departments/${row.id}`);
      loadReferences();
    } catch (err) { showError(err); }
  });
};

const openPosDialog = (row) => {
  simpleDialog.value = {
    show: true, type: 'pos', isEdit: !!row, id: row?.id || null,
    title: row ? 'Редактировать должность' : 'Новая должность',
    name: row?.name || '',
  };
};

const deletePos = (row) => {
  $q.dialog({ title: 'Удаление', message: `Удалить должность ${row.name}?`, cancel: true }).onOk(async () => {
    try {
      await api.delete(`/positions/${row.id}`);
      loadReferences();
    } catch (err) { showError(err); }
  });
};

const submitSimpleForm = async () => {
  const d = simpleDialog.value;
  try {
    if (d.type === 'org') {
      if (d.isEdit) await api.put(`/organizations/${d.id}`, { name: d.name, comment: d.comment });
      else await api.post('/organizations', { name: d.name, comment: d.comment });
    } else if (d.type === 'dept') {
      const payload = { name: d.name, comment: d.comment, organization_id: d.organization_id, parent_id: d.parent_id || null };
      if (d.isEdit) await api.put(`/departments/${d.id}`, payload);
      else await api.post('/departments', payload);
    } else if (d.type === 'pos') {
      if (d.isEdit) await api.put(`/positions/${d.id}`, { name: d.name });
      else await api.post('/positions', { name: d.name });
    }
    simpleDialog.value.show = false;
    loadReferences();
  } catch (err) { showError(err); }
};

const getAvailableParents = () => {
  const d = simpleDialog.value;
  return departments.value.filter(dep => !dep.deleted_at && dep.id !== d.id && (!d.organization_id || dep.organization_id === d.organization_id));
};

// Утилиты форматирования
const formatMoney = (val) => {
  if (!val) return '—';
  return Number(val).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
};

const getStatusLabel = (status) => {
  if (status === 'employed') return 'Работает';
  if (status === 'fired') return 'Уволен';
  return 'Не трудоустроен';
};

const getActionTypeLabel = (type) => {
  switch (type) {
    case 'hire': return 'Прием на работу';
    case 'transfer_dept': return 'Кадровый перевод';
    case 'change_salary': return 'Изменение оклада';
    case 'fire': return 'Увольнение';
    default: return type;
  }
};

const getActionIcon = (type) => {
  switch (type) {
    case 'hire': return 'how_to_reg';
    case 'transfer_dept': return 'swap_horiz';
    case 'change_salary': return 'payments';
    case 'fire': return 'person_remove';
    default: return 'event';
  }
};

const getActionColor = (type) => {
  switch (type) {
    case 'hire': return 'positive';
    case 'transfer_dept': return 'primary';
    case 'change_salary': return 'amber-9';
    case 'fire': return 'negative';
    default: return 'grey';
  }
};

const showError = (err) => {
  const msg = err.response?.data?.message || err.message || 'Произошла непредвиденная ошибка';
  $q.notify({ type: 'negative', message: Array.isArray(msg) ? msg.join('; ') : msg });
};

onMounted(() => {
  loadEmployees();
  loadReferences();
});
</script>