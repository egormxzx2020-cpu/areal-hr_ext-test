import * as Joi from 'joi';
import type { UserRole } from '../auth/auth.service';

export class CreateUserDto {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  login: string;
  password: string;
  role: UserRole;
}

export class UpdateUserDto {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  login: string;
  password?: string;
  role: UserRole;
}

const loginPattern = /^[a-zA-Z0-9._-]+$/;

export const createUserSchema = Joi.object<CreateUserDto>({
  last_name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Фамилия обязательна для заполнения',
    'string.max': 'Фамилия не должна превышать 100 символов',
    'any.required': 'Фамилия обязательна для заполнения',
  }),
  first_name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Имя обязательно для заполнения',
    'string.max': 'Имя не должно превышать 100 символов',
    'any.required': 'Имя обязательно для заполнения',
  }),
  middle_name: Joi.string().trim().max(100).allow('', null).optional().messages({
    'string.max': 'Отчество не должно превышать 100 символов',
  }),
  login: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .pattern(loginPattern)
    .required()
    .messages({
      'string.empty': 'Логин обязателен для заполнения',
      'string.min': 'Логин должен содержать минимум 3 символа',
      'string.max': 'Логин не должен превышать 100 символов',
      'string.pattern.base':
        'Логин может содержать только латинские буквы, цифры, точку, дефис и нижнее подчеркивание',
      'any.required': 'Логин обязателен для заполнения',
    }),
  password: Joi.string().min(8).max(128).required().messages({
    'string.empty': 'Пароль обязателен для заполнения',
    'string.min': 'Пароль должен содержать минимум 8 символов',
    'string.max': 'Пароль не должен превышать 128 символов',
    'any.required': 'Пароль обязателен для заполнения',
  }),
  role: Joi.string().valid('admin', 'hr_manager').required().messages({
    'any.only': 'Роль должна быть одной из: admin, hr_manager',
    'any.required': 'Роль обязательна для заполнения',
  }),
});

export const updateUserSchema = Joi.object<UpdateUserDto>({
  last_name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Фамилия обязательна для заполнения',
    'string.max': 'Фамилия не должна превышать 100 символов',
    'any.required': 'Фамилия обязательна для заполнения',
  }),
  first_name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Имя обязательно для заполнения',
    'string.max': 'Имя не должно превышать 100 символов',
    'any.required': 'Имя обязательно для заполнения',
  }),
  middle_name: Joi.string().trim().max(100).allow('', null).optional().messages({
    'string.max': 'Отчество не должно превышать 100 символов',
  }),
  login: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .pattern(loginPattern)
    .required()
    .messages({
      'string.empty': 'Логин обязателен для заполнения',
      'string.min': 'Логин должен содержать минимум 3 символа',
      'string.max': 'Логин не должен превышать 100 символов',
      'string.pattern.base':
        'Логин может содержать только латинские буквы, цифры, точку, дефис и нижнее подчеркивание',
      'any.required': 'Логин обязателен для заполнения',
    }),
  password: Joi.string().min(8).max(128).allow('', null).optional().messages({
    'string.min': 'Новый пароль должен содержать минимум 8 символов',
    'string.max': 'Новый пароль не должен превышать 128 символов',
  }),
  role: Joi.string().valid('admin', 'hr_manager').required().messages({
    'any.only': 'Роль должна быть одной из: admin, hr_manager',
    'any.required': 'Роль обязательна для заполнения',
  }),
});