import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  ParseUUIDPipe,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import { FilesService } from './files.service';
import {
  multerStorageConfig,
  fileFilterConfig,
  MAX_FILE_SIZE,
} from './files.constants';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Загрузка одного файла скана
   * POST /files/upload
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerStorageConfig,
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: fileFilterConfig,
    }),
  )
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не был передан');
    }
    return this.filesService.saveFile(file);
  }

  /**
   * Загрузка пачки файлов сканов (до 10 файлов за раз)
   * POST /files/upload-multiple
   */
  @Post('upload-multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerStorageConfig,
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: fileFilterConfig,
    }),
  )
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Файлы не были переданы');
    }
    return Promise.all(files.map((file) => this.filesService.saveFile(file)));
  }

  /**
   * Получение метаданных файла
   * GET /files/:id
   */
  @Get(':id')
  async getFileInfo(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const file = await this.filesService.findById(id);
    return {
      id: file.id,
      name: file.name,
      mime_type: file.mime_type,
      size: file.size,
      created_at: file.created_at,
      updated_at: file.updated_at,
    };
  }

  /**
   * Просмотр или скачивание файла
   * GET /files/:id/download
   */
  @Get(':id/download')
  async downloadFile(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.filesService.findById(id);

    if (!fs.existsSync(file.file_path)) {
      throw new NotFoundException('Физический файл не найден на сервере');
    }

    const encodedName = encodeURIComponent(file.name);
    res.set({
      'Content-Type': file.mime_type,
      'Content-Disposition': `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    });

    const fileStream = fs.createReadStream(file.file_path);
    return new StreamableFile(fileStream);
  }

  /**
   * Мягкое удаление файла
   * DELETE /files/:id
   */
  @Delete(':id')
  async removeFile(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.filesService.softDelete(id);
  }
}