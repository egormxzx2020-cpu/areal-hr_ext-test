<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card style="width: 780px; max-width: 95vw">
      <q-card-section class="row items-center bg-primary text-white">
        <div class="text-h6">
          {{ employeeId ? 'Редактирование сотрудника' : 'Новый сотрудник' }}
        </div>
        <q-space />
        <q-btn v-close-popup icon="close" flat round dense />
      </q-card-section>

      <q-form @submit.prevent="saveEmployee">
        <q-card-section class="scroll" style="max-height: 75vh">
          <q-inner-loading :showing="loadingDetails" />

          <div class="text-subtitle2 text-primary q-mb-sm">
            1. Личные данные
          </div>
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-12 col-sm-4">
              <q-input
                v-model="form.last_name"
                label="Фамилия *"
                outlined
                dense
                :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model="form.first_name"
                label="Имя *"
                outlined
                dense
                :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model="form.middle_name"
                label="Отчество"
                outlined
                dense
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model="form.birth_date"
                label="Дата рождения *"
                type="date"
                outlined
                dense
                stack-label
                :rules="[(val) => !!val || 'Укажите дату рождения']"
              />
            </div>
          </div>

          <div class="text-subtitle2 text-primary q-mb-sm">
            2. Паспортные данные (РФ)
          </div>
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-6 col-sm-3">
              <q-input
                v-model="form.passport_series"
                label="Серия *"
                mask="####"
                outlined
                dense
                :rules="[(val) => /^\d{4}$/.test(val) || 'Ровно 4 цифры']"
              />
            </div>
            <div class="col-6 col-sm-3">
              <q-input
                v-model="form.passport_number"
                label="Номер *"
                mask="######"
                outlined
                dense
                :rules="[(val) => /^\d{6}$/.test(val) || 'Ровно 6 цифр']"
              />
            </div>
            <div class="col-6 col-sm-3">
              <q-input
                v-model="form.passport_issue_date"
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
                v-model="form.passport_department_code"
                label="Код подразделения *"
                mask="###-###"
                outlined
                dense
                :rules="[(val) => /^\d{3}-\d{3}$/.test(val) || 'Формат 000-000']"
              />
            </div>
            <div class="col-12">
              <q-input
                v-model="form.passport_issued_by"
                label="Кем выдан *"
                outlined
                dense
                :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
              />
            </div>
          </div>

          <div class="text-subtitle2 text-primary q-mb-sm">
            3. Адрес регистрации
          </div>
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.reg_region"
                label="Регион / Область *"
                outlined
                dense
                :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.reg_city"
                label="Город / Населенный пункт *"
                outlined
                dense
                :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.reg_street"
                label="Улица *"
                outlined
                dense
                :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
              />
            </div>
            <div class="col-4 col-sm-2">
              <q-input
                v-model="form.reg_house"
                label="Дом *"
                outlined
                dense
                :rules="[(val) => !!val?.trim() || 'Обяз.']"
              />
            </div>
            <div class="col-4 col-sm-2">
              <q-input
                v-model="form.reg_building"
                label="Корпус"
                outlined
                dense
              />
            </div>
            <div class="col-4 col-sm-2">
              <q-input
                v-model="form.reg_apartment"
                label="Квартира"
                outlined
                dense
              />
            </div>
          </div>

          <div class="text-subtitle2 text-primary q-mb-sm">
            4. Сканы паспорта (JPG, PNG, WEBP, PDF до 10 МБ)
          </div>
          <q-file
            v-model="selectedFiles"
            multiple
            outlined
            dense
            clearable
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            label="Выберите файлы сканов для загрузки"
            :loading="uploading"
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

        <q-card-actions align="right" class="q-pa-md bg-grey-1">
          <q-btn v-close-popup flat label="Отмена" color="grey-7" />
          <q-btn
            type="submit"
            color="primary"
            :label="employeeId ? 'Сохранить изменения' : 'Добавить сотрудника'"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import {
  formatFileSize,
  getFileDownloadUrl,
  notifySuccess,
  notifyError,
} from '../utils/formatters';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  employeeId: { type: String, default: null },
});

const emit = defineEmits(['update:modelValue', 'saved']);
const $q = useQuasar();

const loadingDetails = ref(false);
const saving = ref(false);
const uploading = ref(false);
const selectedFiles = ref([]);
const attachedFiles = ref([]);

function emptyForm() {
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

const form = ref(emptyForm());

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (!isOpen) return;

    selectedFiles.value = [];
    if (!props.employeeId) {
      form.value = emptyForm();
      attachedFiles.value = [];
      return;
    }

    loadingDetails.value = true;
    try {
      const { data } = await api.get(`/employees/${props.employeeId}`);
      form.value = {
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
      attachedFiles.value = Array.isArray(data.passport_files)
        ? [...data.passport_files]
        : [];
    } catch (err) {
      notifyError($q, err, 'Не удалось загрузить анкету сотрудника');
      emit('update:modelValue', false);
    } finally {
      loadingDetails.value = false;
    }
  },
);

async function handleFilesUpload(files) {
  if (!files || files.length === 0) return;

  uploading.value = true;
  try {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const { data } = await api.post('/files/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    attachedFiles.value.push(...data);
    selectedFiles.value = [];
    notifySuccess($q, `Загружено файлов: ${data.length}`);
  } catch (err) {
    notifyError($q, err, 'Ошибка при загрузке сканов');
  } finally {
    uploading.value = false;
  }
}

function removeAttachedFile(fileId) {
  attachedFiles.value = attachedFiles.value.filter((f) => f.id !== fileId);
}

async function saveEmployee() {
  saving.value = true;
  try {
    const payload = {
      ...form.value,
      middle_name: form.value.middle_name?.trim() || null,
      reg_building: form.value.reg_building?.trim() || null,
      reg_apartment: form.value.reg_apartment?.trim() || null,
      file_ids: attachedFiles.value.map((f) => f.id),
    };

    if (props.employeeId) {
      await api.put(`/employees/${props.employeeId}`, payload);
      notifySuccess($q, 'Данные сотрудника обновлены');
    } else {
      await api.post('/employees', payload);
      notifySuccess($q, 'Сотрудник успешно добавлен');
    }

    emit('update:modelValue', false);
    emit('saved');
  } catch (err) {
    notifyError($q, err, 'Ошибка при сохранении сотрудника');
  } finally {
    saving.value = false;
  }
}
</script>