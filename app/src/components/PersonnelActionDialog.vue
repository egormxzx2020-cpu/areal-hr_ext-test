<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="row items-center bg-teal text-white">
        <div class="text-h6">Новый кадровый приказ</div>
        <q-space />
        <q-btn v-close-popup icon="close" flat round dense />
      </q-card-section>

      <q-form @submit.prevent="submitAction">
        <q-card-section class="q-gutter-sm">
          <div v-if="employee" class="text-body2 q-mb-sm">
            Сотрудник: <strong>{{ formatFullName(employee) }}</strong>
          </div>

          <q-select
            v-model="form.action_type"
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
            v-model="form.action_date"
            label="Дата приказа *"
            type="date"
            outlined
            dense
            stack-label
            :rules="[(val) => !!val || 'Укажите дату приказа']"
          />

          <q-select
            v-if="
              form.action_type === 'hire' ||
              form.action_type === 'transfer_dept'
            "
            v-model="form.department_id"
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
              form.action_type === 'hire' ||
              form.action_type === 'transfer_dept'
            "
            v-model="form.position_id"
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
              form.action_type === 'hire' ||
              form.action_type === 'change_salary'
            "
            v-model.number="form.salary"
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
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import {
  formatFullName,
  getTodayIsoDate,
  notifySuccess,
  notifyError,
} from '../utils/formatters';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  employee: { type: Object, default: null },
  departments: { type: Array, default: () => [] },
  positions: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'saved']);
const $q = useQuasar();

const saving = ref(false);
const form = ref({
  action_type: 'hire',
  department_id: null,
  position_id: null,
  salary: null,
  action_date: getTodayIsoDate(),
});

const activeDepartments = computed(() =>
  props.departments.filter((d) => !d.deleted_at),
);

const activePositions = computed(() =>
  props.positions.filter((p) => !p.deleted_at),
);

const availableActionTypes = computed(() => {
  if (props.employee?.employment_status === 'employed') {
    return [
      { label: 'Кадровый перевод (отдел / должность)', value: 'transfer_dept' },
      { label: 'Изменение оклада', value: 'change_salary' },
      { label: 'Увольнение', value: 'fire' },
    ];
  }
  return [{ label: 'Прием на работу', value: 'hire' }];
});

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen || !props.employee) return;

    const emp = props.employee;
    const isEmployed = emp.employment_status === 'employed';
    form.value = {
      action_type: isEmployed ? 'transfer_dept' : 'hire',
      department_id: isEmployed ? emp.current_department_id || null : null,
      position_id: isEmployed ? emp.current_position_id || null : null,
      salary: isEmployed && emp.current_salary ? Number(emp.current_salary) : null,
      action_date: getTodayIsoDate(),
    };
  },
);

async function submitAction() {
  if (!props.employee) return;

  saving.value = true;
  try {
    const type = form.value.action_type;
    const payload = {
      employee_id: props.employee.id,
      action_type: type,
      action_date: form.value.action_date,
    };

    if (type === 'hire' || type === 'transfer_dept') {
      payload.department_id = form.value.department_id;
      payload.position_id = form.value.position_id;
    }
    if (type === 'hire' || type === 'change_salary') {
      payload.salary = Number(form.value.salary);
    }

    await api.post('/personnel-actions', payload);
    notifySuccess($q, 'Кадровый приказ успешно проведен');
    emit('update:modelValue', false);
    emit('saved');
  } catch (err) {
    notifyError($q, err, 'Ошибка при проведении кадрового приказа');
  } finally {
    saving.value = false;
  }
}
</script>