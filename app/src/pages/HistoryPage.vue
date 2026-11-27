<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
        <div class="col-12 col-sm-auto">
          <div class="text-h6">История изменений</div>
        </div>

        <div class="col-12 col-sm-auto row items-center q-gutter-sm">
          <q-select
            v-model="entityFilter"
            :options="entityOptions"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            outlined
            dense
            clearable
            label="Фильтр по типу объекта"
            style="min-width: 240px"
            @update:model-value="fetchLogs"
          />
          <q-btn
            outline
            color="primary"
            icon="refresh"
            label="Обновить"
            :loading="loading"
            @click="fetchLogs"
          />
        </div>
      </div>

      <q-table
        :rows="logs"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        bordered
        :pagination="{ rowsPerPage: 15 }"
        no-data-label="Записи в журнале изменений отсутствуют"
      >
        <template #body-cell-changed_at="props">
          <q-td :props="props" style="white-space: nowrap">
            {{ formatDateTime(props.row.changed_at) }}
          </q-td>
        </template>

        <template #body-cell-operation="props">
          <q-td :props="props">
            <q-badge
              :color="getOperationBadge(props.row.changed_fields).color"
              :label="getOperationBadge(props.row.changed_fields).label"
            />
          </q-td>
        </template>

        <template #body-cell-entity="props">
          <q-td :props="props">
            <div>
              <q-badge
                outline
                :color="getEntityColor(props.row.entity_type)"
                :label="getEntityLabel(props.row.entity_type)"
              />
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">
              ID: {{ props.row.entity_id }}
            </div>
          </q-td>
        </template>

        <template #body-cell-author="props">
          <q-td :props="props">
            <template v-if="props.row.user_id">
              <div class="text-body2">
                {{ props.row.user_full_name || 'Пользователь' }}
              </div>
              <div v-if="props.row.user_login" class="text-caption text-grey-7">
                @{{ props.row.user_login }}
              </div>
            </template>
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
              <strong>{{ formatFieldName(String(fieldKey)) }}:</strong>
              <span class="text-negative q-mx-xs">
                {{ formatFieldValue(String(fieldKey), diff?.old) }}
              </span>
              <q-icon name="arrow_forward" size="12px" class="text-grey-6" />
              <span class="text-positive text-weight-medium q-ml-xs">
                {{ formatFieldValue(String(fieldKey), diff?.new) }}
              </span>
            </div>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { formatDateTime, formatSalary, notifyError } from '../utils/formatters';

const $q = useQuasar();

const logs = ref([]);
const loading = ref(false);
const entityFilter = ref(null);

const entityOptions = [
  { label: 'Сотрудники', value: 'Employee' },
  { label: 'Кадровые приказы', value: 'PersonnelAction' },
  { label: 'Организации', value: 'Organization' },
  { label: 'Отделы', value: 'Department' },
  { label: 'Должности', value: 'Position' },
  { label: 'Пользователи', value: 'User' },
];

const columns = [
  { name: 'changed_at', label: 'Дата и время', field: 'changed_at', align: 'left', sortable: true },
  { name: 'operation', label: 'Событие', field: 'id', align: 'left' },
  { name: 'entity', label: 'Объект', field: 'entity_type', align: 'left' },
  { name: 'author', label: 'Автор', field: 'user_id', align: 'left' },
  { name: 'changed_fields', label: 'Измененные поля (Было → Стало)', field: 'changed_fields', align: 'left' },
];

const FIELD_LABELS = {
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
  file_ids: 'Сканы паспорта',
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
  login: 'Логин',
  role: 'Роль',
  password_hash: 'Пароль',
  deleted_at: 'Дата удаления',
};

const ACTION_LABELS = {
  hire: 'Прием на работу',
  transfer_dept: 'Кадровый перевод',
  change_salary: 'Изменение оклада',
  fire: 'Увольнение',
};

const ROLE_LABELS = {
  admin: 'Администратор',
  hr_manager: 'Менеджер по персоналу',
};

function getEntityLabel(type) {
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

function getEntityColor(type) {
  const map = {
    Employee: 'primary',
    PersonnelAction: 'teal',
    Organization: 'indigo',
    Department: 'deep-purple',
    Position: 'blue-grey',
    User: 'deep-orange',
  };
  return map[type] || 'grey-8';
}

function getOperationBadge(changedFields) {
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

function formatFieldName(key) {
  return FIELD_LABELS[key] || key;
}

function formatFieldValue(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'action_type') return ACTION_LABELS[val] || val;
  if (key === 'role') return ROLE_LABELS[val] || val;
  if (key === 'salary') return formatSalary(val);
  if (key === 'deleted_at') return formatDateTime(val);
  if (key === 'password_hash') return '••••••';
  if (Array.isArray(val)) return val.length ? `${val.length} файл(ов)` : '—';
  return String(val);
}

async function fetchLogs() {
  loading.value = true;
  try {
    const params = { limit: 100, offset: 0 };
    if (entityFilter.value) {
      params.entity_type = entityFilter.value;
    }
    const { data } = await api.get('/audit-logs', { params });
    logs.value = data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить историю изменений');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchLogs);
</script>