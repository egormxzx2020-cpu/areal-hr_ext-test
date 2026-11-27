<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card style="width: 800px; max-width: 95vw">
      <q-card-section class="row items-center bg-info text-white">
        <div class="text-h6">
          Личное дело: {{ employee ? formatFullName(employee) : '' }}
        </div>
        <q-space />
        <q-btn v-close-popup icon="close" flat round dense />
      </q-card-section>

      <q-card-section class="scroll" style="max-height: 75vh">
        <q-inner-loading :showing="loading" />

        <template v-if="employee">
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-12 col-sm-6">
              <q-card flat bordered class="q-pa-sm bg-grey-1">
                <div class="text-subtitle2 text-primary q-mb-xs">
                  Паспорт и регистрация
                </div>
                <div class="text-body2">
                  <strong>Дата рождения:</strong>
                  {{ formatDate(employee.birth_date) }}
                </div>
                <div class="text-body2">
                  <strong>Паспорт:</strong>
                  {{ employee.passport_series }} {{ employee.passport_number }}
                  (выдан {{ formatDate(employee.passport_issue_date) }}, код
                  {{ employee.passport_department_code }})
                </div>
                <div class="text-body2">
                  <strong>Кем выдан:</strong>
                  {{ employee.passport_issued_by }}
                </div>
                <div class="text-body2 q-mt-xs">
                  <strong>Адрес:</strong>
                  {{ employee.reg_region }}, г. {{ employee.reg_city }}, ул.
                  {{ employee.reg_street }}, д. {{ employee.reg_house }}
                  <span v-if="employee.reg_building">
                    , корп. {{ employee.reg_building }}
                  </span>
                  <span v-if="employee.reg_apartment">
                    , кв. {{ employee.reg_apartment }}
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
                    :color="getEmploymentStatusColor(employee.employment_status)"
                    :label="getEmploymentStatusLabel(employee.employment_status)"
                  />
                </div>
                <div class="text-body2">
                  <strong>Отдел:</strong>
                  {{ employee.current_department_name || '—' }}
                </div>
                <div class="text-body2">
                  <strong>Должность:</strong>
                  {{ employee.current_position_name || '—' }}
                </div>
                <div class="text-body2">
                  <strong>Оклад:</strong>
                  {{
                    employee.current_salary
                      ? formatSalary(employee.current_salary)
                      : '—'
                  }}
                </div>
              </q-card>
            </div>
          </div>

          <div class="text-subtitle2 text-primary q-mb-xs">
            Прикрепленные сканы паспорта
          </div>
          <div
            v-if="!employee.passport_files || employee.passport_files.length === 0"
            class="text-caption text-grey-7 q-mb-md"
          >
            Сканы документов не прикреплены
          </div>
          <div v-else class="row q-gutter-sm q-mb-md">
            <q-btn
              v-for="file in employee.passport_files"
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

          <div class="row items-center justify-between q-mb-sm">
            <div class="text-subtitle2 text-primary">
              Хронология кадровых приказов
            </div>
            <q-btn
              v-if="!employee.deleted_at"
              dense
              color="teal"
              icon="add"
              label="Новый приказ"
              @click="emit('open-action', employee)"
            />
          </div>

          <div
            v-if="!loading && actions.length === 0"
            class="text-caption text-grey-7"
          >
            Кадровые приказы еще не оформлялись
          </div>

          <q-timeline v-else color="primary" layout="dense">
            <q-timeline-entry
              v-for="(act, idx) in actions"
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
                  v-if="idx === 0 && !employee.deleted_at"
                  flat
                  round
                  dense
                  size="sm"
                  color="negative"
                  icon="delete_outline"
                  @click="confirmCancelAction(act)"
                >
                  <q-tooltip>Отменить последний приказ</q-tooltip>
                </q-btn>
              </div>
            </q-timeline-entry>
          </q-timeline>
        </template>
      </q-card-section>

      <q-separator />
      <q-card-actions align="right">
        <q-btn v-close-popup flat label="Закрыть" color="primary" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import {
  formatFullName,
  formatDate,
  formatSalary,
  formatFileSize,
  getFileDownloadUrl,
  getEmploymentStatusLabel,
  getEmploymentStatusColor,
  getActionTypeLabel,
  getActionTypeColor,
  notifySuccess,
  notifyError,
} from '../utils/formatters';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  employeeId: { type: String, default: null },
});

const emit = defineEmits(['update:modelValue', 'open-action', 'changed']);
const $q = useQuasar();

const employee = ref(null);
const actions = ref([]);
const loading = ref(false);

async function loadDetails() {
  if (!props.employeeId) return;

  loading.value = true;
  try {
    const [empRes, actionsRes] = await Promise.all([
      api.get(`/employees/${props.employeeId}`),
      api.get(`/personnel-actions/employee/${props.employeeId}`),
    ]);
    employee.value = empRes.data;
    actions.value = actionsRes.data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить личное дело сотрудника');
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      loadDetails();
    }
  },
);

function confirmCancelAction(act) {
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
      notifySuccess($q, 'Кадровый приказ отменен');
      await loadDetails();
      emit('changed');
    } catch (err) {
      notifyError($q, err, 'Не удалось отменить кадровый приказ');
    }
  });
}

defineExpose({ reload: loadDetails });
</script>