import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Auth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get app settings and targets' })
  async get(@CurrentUser('userId') userId: string) {
    const data = await this.settingsService.get(userId);
    return { ...data, __message: 'Settings retrieved successfully' };
  }

  @Get('options')
  @ApiOperation({ summary: 'List the available setting values' })
  options() {
    return {
      ...this.settingsService.getOptions(),
      __message: 'Setting options retrieved successfully',
    };
  }

  @Put()
  @ApiOperation({ summary: 'Update app settings and targets' })
  async update(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    const data = await this.settingsService.update(userId, dto);
    return { ...data, __message: 'Settings updated successfully' };
  }
}
