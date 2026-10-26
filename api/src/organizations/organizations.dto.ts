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
    'string.empty': 'Наименование организации не может быть пустым',
    'string.min': 'Наименование должно содержать минимум 2 символа',
    'any.required': 'Поле name обязательно для заполнения',
  }),
  comment: Joi.string().allow('', null).optional(),
});