<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
        <div class="col-12 col-md-4">
          <q-input
            v-model="search"
            outlined
            dense
            clearable
            debounce="350"
            placeholder="Поиск по фамилии, имени или паспорту..."
            @update:model-value="fetchEmployees"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-auto row items-center q-gutter-md">
          <q-toggle
            v-model="showDeleted"
            label="Показывать удаленных"
            color="negative"
            dense
          />
          <q-btn
            color="primary"
            icon="person_add"
            label="Добавить сотрудника"
            @click="openCreateDialog"
          />
        </div>
      </div>

      <q-table
        :rows="filteredEmployees"
        :columns="columns"
        row-key="id"
        :loading="loading"
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
              @click="openDetails(props.row)"
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
              @click="openEditDialog(props.row)"
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
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>Удалить сотрудника</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <EmployeeFormDialog
      v-model="formDialogOpen"
      :employee-id="editingEmployeeId"
      @saved="fetchEmployees"
    />

    <EmployeeDetailsDialog
      ref="detailsDialogRef"
      v-model="detailsDialogOpen"
      :employee-id="detailsEmployeeId"
      @open-action="openActionDialog"
      @changed="fetchEmployees"
    />

    <PersonnelActionDialog
      v-model="actionDialogOpen"
      :employee="actionTargetEmployee"
      :departments="departments"
      :positions="positions"
      @saved="onActionSaved"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import EmployeeFormDialog from '../components/EmployeeFormDialog.vue';
import EmployeeDetailsDialog from '../components/EmployeeDetailsDialog.vue';
import PersonnelActionDialog from '../components/PersonnelActionDialog.vue';
import {
  formatFullName,
  formatDate,
  formatSalary,
  getEmploymentStatusLabel,
  getEmploymentStatusColor,
  notifySuccess,
  notifyError,
} from '../utils/formatters';

const $q = useQuasar();

const employees = ref([]);
const departments = ref([]);
const positions = ref([]);
const loading = ref(false);
const search = ref('');
const showDeleted = ref(false);

const formDialogOpen = ref(false);
const editingEmployeeId = ref(null);

const detailsDialogRef = ref(null);
const detailsDialogOpen = ref(false);
const detailsEmployeeId = ref(null);

const actionDialogOpen = ref(false);
const actionTargetEmployee = ref(null);

const columns = [
  { name: 'full_name', label: 'ФИО сотрудника', field: 'last_name', align: 'left', sortable: true },
  { name: 'passport', label: 'Паспорт РФ', field: 'passport_number', align: 'left' },
  { name: 'employment', label: 'Кадровый статус и должность', field: 'employment_status', align: 'left' },
  { name: 'files_count', label: 'Сканы', field: 'files_count', align: 'center' },
  { name: 'status', label: 'Запись', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const filteredEmployees = computed(() =>
  showDeleted.value
    ? employees.value
    : employees.value.filter((e) => !e.deleted_at),
);

async function fetchEmployees() {
  loading.value = true;
  try {
    const params = {};
    if (search.value?.trim()) {
      params.search = search.value.trim();
    }
    const { data } = await api.get('/employees', { params });
    employees.value = data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить список сотрудников');
  } finally {
    loading.value = false;
  }
}

async function fetchReferences() {
  try {
    const [deptsRes, posRes] = await Promise.all([
      api.get('/departments'),
      api.get('/positions'),
    ]);
    departments.value = deptsRes.data;
    positions.value = posRes.data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить справочники');
  }
}

function openCreateDialog() {
  editingEmployeeId.value = null;
  formDialogOpen.value = true;
}

function openEditDialog(emp) {
  editingEmployeeId.value = emp.id;
  formDialogOpen.value = true;
}

function openDetails(emp) {
  detailsEmployeeId.value = emp.id;
  detailsDialogOpen.value = true;
}

function openActionDialog(emp) {
  actionTargetEmployee.value = emp;
  actionDialogOpen.value = true;
}

async function onActionSaved() {
  await fetchEmployees();
  if (detailsDialogOpen.value && detailsDialogRef.value) {
    await detailsDialogRef.value.reload();
  }
}

function confirmDelete(emp) {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Вы действительно хотите удалить сотрудника «${formatFullName(emp)}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/employees/${emp.id}`);
      notifySuccess($q, 'Сотрудник помечен как удаленный');
      await fetchEmployees();
    } catch (err) {
      notifyError($q, err, 'Не удалось удалить сотрудника');
    }
  });
}

onMounted(async () => {
  await Promise.all([fetchEmployees(), fetchReferences()]);
});
</script>