import * as Joi from 'joi';

export class CreateOrganizationDto {
  name: string;
  comment?: string;
}

export class UpdateOrganizationDto {
  name: string;
  comment?: string;
}

export const createOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required().messages({
    'string.base': 'Наименование организации должно быть строкой',
    'string.empty': 'Наименование организации не может быть пустым',
    'string.min': 'Наименование организации должно содержать минимум {#limit} символа',
    'string.max': 'Наименование организации не должно превышать {#limit} символов',
    'any.required': 'Поле «Наименование организации» обязательно для заполнения',
  }),
  comment: Joi.string().trim().allow('', null).max(1000).optional().messages({
    'string.base': 'Комментарий должен быть строкой',
    'string.max': 'Комментарий не должен превышать {#limit} символов',
  }),
});

export const updateOrganizationSchema = createOrganizationSchema;