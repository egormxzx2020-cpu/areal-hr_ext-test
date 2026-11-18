import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  ParseUUIDPipe,
  StreamableFile,
  Res,
  UseGuards,
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
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('files')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin', 'hr_manager')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

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

  @Delete(':id')
  async removeFile(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.filesService.softDelete(id);
  }

  @Post('cleanup-orphans')
  async cleanupOrphans(@Query('hours') hours?: string) {
    let parsedHours = 24;

    if (hours !== undefined && hours !== '') {
      if (!/^\d+(\.\d+)?$/.test(hours.trim())) {
        throw new BadRequestException(
          'Параметр hours должен быть положительным числом',
        );
      }
      parsedHours = Number(hours);
      if (
        !Number.isFinite(parsedHours) ||
        parsedHours <= 0 ||
        parsedHours > 8760
      ) {
        throw new BadRequestException(
          'Параметр hours должен быть в диапазоне от 0.01 до 8760',
        );
      }
    }

    return this.filesService.cleanupOrphanFiles(parsedHours);
  }
}