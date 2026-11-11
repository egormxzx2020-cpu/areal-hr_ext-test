import * as Joi from 'joi';

export type ActionType = 'hire' | 'transfer_dept' | 'change_salary' | 'fire';

export class CreatePersonnelActionDto {
  employee_id: string;
  action_type: ActionType;
  department_id?: string | null;
  position_id?: string | null;
  salary?: number | null;
  action_date: string;
}

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

export const createPersonnelActionSchema = Joi.object({
  employee_id: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Идентификатор сотрудника должен быть валидным UUID',
    'any.required': 'Поле employee_id обязательно для заполнения',
  }),

  action_type: Joi.string()
    .valid('hire', 'transfer_dept', 'change_salary', 'fire')
    .required()
    .messages({
      'any.only': 'Тип операции должен быть: hire, transfer_dept, change_salary или fire',
      'any.required': 'Тип кадровой операции обязателен',
    }),

  department_id: Joi.alternatives().conditional('action_type', {
    is: Joi.valid('hire', 'transfer_dept'),
    then: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
      'any.required': 'Для приема и перевода необходимо указать подразделение',
      'string.guid': 'Идентификатор подразделения должен быть валидным UUID',
    }),
    otherwise: Joi.string().uuid({ version: 'uuidv4' }).allow(null).optional(),
  }),

  position_id: Joi.alternatives().conditional('action_type', {
    is: Joi.valid('hire', 'transfer_dept'),
    then: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
      'any.required': 'Для приема и перевода необходимо указать должность',
      'string.guid': 'Идентификатор должности должен быть валидным UUID',
    }),
    otherwise: Joi.string().uuid({ version: 'uuidv4' }).allow(null).optional(),
  }),

  salary: Joi.alternatives().conditional('action_type', {
    is: Joi.valid('hire', 'change_salary'),
    then: Joi.number().positive().precision(2).required().messages({
      'number.base': 'Оклад должен быть числом',
      'number.positive': 'Оклад должен быть положительным числом',
      'any.required': 'Оклад обязателен при приеме на работу и изменении оклада',
    }),
    otherwise: Joi.number().positive().precision(2).allow(null).optional(),
  }),

  action_date: Joi.string()
    .custom(dateCustomValidator)
    .required()
    .messages({
      'string.empty': 'Дата кадрового события обязательна для заполнения',
      'string.pattern.base': 'Дата должна быть в формате ГГГГ-ММ-ДД',
      'date.calendar': 'Дата содержит несуществующий календарный день',
      'any.required': 'Дата кадрового события обязательна',
    }),
});