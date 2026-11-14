import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@Auth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image or video and get its URL' })
  async upload(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Query('folder') folder?: string,
  ) {
    // The request carries the host the client reached us on, which is what the
    // returned media URL has to point at.
    const data = await this.mediaService.saveUpload(userId, file, folder || 'misc', req);
    return { ...data, __message: 'File uploaded successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'List uploaded media' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: PaginationDto,
    @Query('mediaType') mediaType?: string,
  ) {
    const data = await this.mediaService.findAll(userId, query, mediaType);
    return { ...data, __message: 'Media retrieved successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a media asset and its stored file' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.mediaService.remove(userId, id);
    return { ...data, __message: 'Media deleted successfully' };
  }
}
