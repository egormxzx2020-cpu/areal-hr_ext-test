import * as Joi from 'joi';

export class CreatePositionDto {
  name: string;
}

export class UpdatePositionDto {
  name: string;
}

export const createPositionSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required().messages({
    'string.base': 'Наименование должности должно быть строкой',
    'string.empty': 'Наименование должности не может быть пустым',
    'string.min': 'Наименование должности должно содержать минимум {#limit} символа',
    'string.max': 'Наименование должности не должно превышать {#limit} символов',
    'any.required': 'Поле «Наименование должности» обязательно для заполнения',
  }),
});

export const updatePositionSchema = createPositionSchema;