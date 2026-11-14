import { Body, Controller, Delete, Get, Patch, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateAccountDto, UpdateProfileDto } from './dto/profile.dto';
import { UsersService } from './users.service';

@ApiTags('Profile')
@Auth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get the personal profile with derived metrics' })
  async getProfile(@CurrentUser('userId') userId: string) {
    const data = await this.usersService.getProfile(userId);
    return { ...data, __message: 'Profile retrieved successfully' };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update the personal profile' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const data = await this.usersService.updateProfile(userId, dto);
    return { ...data, __message: 'Profile updated successfully' };
  }

  @Patch('account')
  @ApiOperation({ summary: 'Update account-level fields' })
  async updateAccount(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateAccountDto,
  ) {
    const data = await this.usersService.updateAccount(userId, dto);
    return { ...data, __message: 'Account updated successfully' };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export every personal record as JSON' })
  async exportData(@CurrentUser('userId') userId: string) {
    const data = await this.usersService.exportData(userId);
    return { ...data, __message: 'Data exported successfully' };
  }

  @Delete('data')
  @ApiOperation({ summary: 'Delete all tracked data but keep the account' })
  async deleteData(@CurrentUser('userId') userId: string) {
    const data = await this.usersService.deleteAccountData(userId);
    return { ...data, __message: 'All tracked data deleted successfully' };
  }
}
