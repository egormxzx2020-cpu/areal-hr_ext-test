import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { ObjectSchema } from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private readonly schema: ObjectSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    // Валидируем только тело запроса (@Body)
    if (metadata.type !== 'body') {
      return value;
    }

    const { error, value: validatedValue } = this.schema.validate(value, {
      abortEarly: false, // собираем все ошибки, а не только первую
      stripUnknown: true, // удаляем не описанные в DTO поля для защиты от инъекций
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message).join('; ');
      throw new BadRequestException(messages);
    }

    return validatedValue;
  }
}