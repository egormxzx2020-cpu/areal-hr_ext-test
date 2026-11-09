import * as Joi from 'joi';

export class CreateEmployeeDto {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  birth_date: string;
  passport_series: string;
  passport_number: string;
  passport_issue_date: string;
  passport_department_code: string;
  passport_issued_by: string;
  reg_region: string;
  reg_city: string;
  reg_street: string;
  reg_house: string;
  reg_building?: string | null;
  reg_apartment?: string | null;
  file_ids?: string[];
}

export class UpdateEmployeeDto extends CreateEmployeeDto {}

const passportSeriesRegex = /^\d{4}$/;
const passportNumberRegex = /^\d{6}$/;
const departmentCodeRegex = /^\d{3}-\d{3}$/;

/**
 * Валидатор реального существования календарного дня в формате ГГГГ-ММ-ДД.
 * Отсекает некорректные даты (например, 2026-13-45, 2026-02-31) до отправки в PostgreSQL.
 */
const dateCustomValidator = (value: string, helpers: Joi.CustomHelpers) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return helpers.error('string.pattern.base');
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    return helpers.error('date.calendar');
  }
  return value;
};

export const employeeValidationSchema = Joi.object({
  last_name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Фамилия обязательна для заполнения',
    'string.min': 'Фамилия должна содержать минимум 2 символа',
    'any.required': 'Фамилия обязательна для заполнения',
  }),
  first_name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Имя обязательно для заполнения',
    'string.min': 'Имя должно содержать минимум 2 символа',
    'any.required': 'Имя обязательно для заполнения',
  }),
  middle_name: Joi.string().trim().max(100).allow('', null).optional(),

  birth_date: Joi.string()
    .custom(dateCustomValidator)
    .required()
    .messages({
      'string.empty': 'Дата рождения обязательна для заполнения',
      'string.pattern.base': 'Дата рождения должна быть в формате ГГГГ-ММ-ДД',
      'date.calendar': 'Дата рождения содержит несуществующую календарную дату',
      'any.required': 'Дата рождения обязательна для заполнения',
    }),

  passport_series: Joi.string().pattern(passportSeriesRegex).required().messages({
    'string.pattern.base': 'Серия паспорта должна состоять ровно из 4 цифр',
    'any.required': 'Серия паспорта обязательна для заполнения',
  }),
  passport_number: Joi.string().pattern(passportNumberRegex).required().messages({
    'string.pattern.base': 'Номер паспорта должен состоять ровно из 6 цифр',
    'any.required': 'Номер паспорта обязателен для заполнения',
  }),
  passport_issue_date: Joi.string()
    .custom(dateCustomValidator)
    .required()
    .messages({
      'string.empty': 'Дата выдачи паспорта обязательна для заполнения',
      'string.pattern.base': 'Дата выдачи паспорта должна быть в формате ГГГГ-ММ-ДД',
      'date.calendar': 'Дата выдачи паспорта содержит несуществующую календарную дату',
      'any.required': 'Дата выдачи паспорта обязательна для заполнения',
    }),
  passport_department_code: Joi.string().pattern(departmentCodeRegex).required().messages({
    'string.pattern.base': 'Код подразделения должен быть в формате 000-000',
    'any.required': 'Код подразделения обязателен для заполнения',
  }),
  passport_issued_by: Joi.string().trim().min(2).max(255).required().messages({
    'string.empty': 'Поле «Кем выдан» обязательно для заполнения',
    'any.required': 'Поле «Кем выдан» обязательно для заполнения',
  }),

  reg_region: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Регион регистрации обязателен для заполнения',
    'any.required': 'Регион регистрации обязателен для заполнения',
  }),
  reg_city: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Город/населенный пункт обязателен для заполнения',
    'any.required': 'Город/населенный пункт обязателен для заполнения',
  }),
  reg_street: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'Улица обязательна для заполнения',
    'any.required': 'Улица обязательна для заполнения',
  }),
  reg_house: Joi.string().trim().min(1).max(20).required().messages({
    'string.empty': 'Номер дома обязателен для заполнения',
    'any.required': 'Номер дома обязателен для заполнения',
  }),
  reg_building: Joi.string().trim().max(20).allow('', null).optional(),
  reg_apartment: Joi.string().trim().max(20).allow('', null).optional(),

  file_ids: Joi.array()
    .items(Joi.string().uuid({ version: 'uuidv4' }))
    .optional()
    .messages({
      'string.guid': 'Идентификатор файла должен быть валидным UUID',
    }),
});