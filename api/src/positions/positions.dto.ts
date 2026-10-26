import * as Joi from 'joi';

export class CreatePositionDto {
  name: string;
}

export class UpdatePositionDto {
  name: string;
}

export const createPositionSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required().messages({
    'string.empty': 'Наименование должности не может быть пустым',
    'string.min': 'Наименование должно содержать минимум 2 символа',
    'any.required': 'Поле name обязательно для заполнения',
  }),
});