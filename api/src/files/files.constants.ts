import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';

// Физический каталог для сохранения сканов паспортов
export const UPLOAD_PASSPORT_DIR = path.resolve(process.cwd(), 'uploads/passports');

// Создание папки при старте приложения, если она отсутствует
if (!fs.existsSync(UPLOAD_PASSPORT_DIR)) {
  fs.mkdirSync(UPLOAD_PASSPORT_DIR, { recursive: true });
}

// Ограничение размера файла: 10 МБ
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Разрешенные MIME-типы (сканы документов: изображения и PDF)
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// Конфигурация хранилища Multer
export const multerStorageConfig = diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_PASSPORT_DIR);
  },
  filename: (req, file, cb) => {
    // Генерация уникального имени: UUID + исходное расширение файла
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

// Фильтр типов файлов
export const fileFilterConfig = (req: any, file: Express.Multer.File, cb: any) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Недопустимый формат файла «${file.mimetype}». Разрешены только JPG, PNG, WEBP и PDF.`,
      ),
      false,
    );
  }
};