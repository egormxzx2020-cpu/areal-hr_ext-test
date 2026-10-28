import * as Joi from 'joi';

export class CreateDepartmentDto {
  organization_id: string;
  parent_id?: string | null;
  name: string;
  comment?: string | null;
}

export class UpdateDepartmentDto {
  organization_id: string;
  parent_id?: string | null;
  name: string;
  comment?: string | null;
}

export const createDepartmentSchema = Joi.object({
  organization_id: Joi.string().uuid().required().messages({
    'string.base': 'Идентификатор организации должен быть строкой',
    'string.empty': 'Идентификатор организации не может быть пустым',
    'string.guid': 'Идентификатор организации должен быть корректным UUID',
    'any.required': 'Поле «Организация» обязательно для заполнения',
  }),
  parent_id: Joi.string().uuid().allow(null, '').empty('').default(null).optional().messages({
    'string.base': 'Идентификатор родительского отдела должен быть строкой',
    'string.guid': 'Идентификатор родительского отдела должен быть корректным UUID',
  }),
  name: Joi.string().trim().min(2).max(255).required().messages({
    'string.base': 'Наименование отдела должно быть строкой',
    'string.empty': 'Наименование отдела не может быть пустым',
    'string.min': 'Наименование отдела должно содержать минимум {#limit} символа',
    'string.max': 'Наименование отдела не должно превышать {#limit} символов',
    'any.required': 'Поле «Наименование отдела» обязательно для заполнения',
  }),
  comment: Joi.string().trim().allow('', null).max(1000).optional().messages({
    'string.base': 'Комментарий должен быть строкой',
    'string.max': 'Комментарий не должен превышать {#limit} символов',
  }),
});

export const updateDepartmentSchema = createDepartmentSchema;