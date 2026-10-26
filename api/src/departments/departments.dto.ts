import * as Joi from 'joi';

export class CreateDepartmentDto {
  organization_id: string;
  parent_id?: string;
  name: string;
  comment?: string;
}

export class UpdateDepartmentDto {
  organization_id: string;
  parent_id?: string;
  name: string;
  comment?: string;
}

export const createDepartmentSchema = Joi.object({
  organization_id: Joi.string().uuid().required().messages({
    'string.guid': 'Некорректный ID организации',
    'any.required': 'Организация обязательна для заполнения',
  }),
  parent_id: Joi.string().uuid().allow(null, '').optional(),
  name: Joi.string().trim().min(2).max(255).required().messages({
    'string.empty': 'Наименование отдела не может быть пустым',
    'string.min': 'Наименование должно содержать минимум 2 символа',
    'any.required': 'Поле name обязательно для заполнения',
  }),
  comment: Joi.string().allow('', null).optional(),
});