import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterOwnerDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return { ...data, __message: 'Signed in successfully' };
  }

  @Public()
  @Post('setup')
  @ApiOperation({
    summary: 'Provision the first owner account (works only on an empty database)',
  })
  async setup(@Body() dto: RegisterOwnerDto) {
    const data = await this.authService.registerOwner(dto);
    return { ...data, __message: 'Owner account created successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    const data = await this.authService.refresh(dto);
    return { ...data, __message: 'Session refreshed' };
  }

  @Auth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(
    @CurrentUser('userId') userId: string,
    @Body() dto: Partial<RefreshTokenDto>,
  ) {
    const data = await this.authService.logout(userId, dto?.refreshToken);
    return { ...data, __message: 'Signed out successfully' };
  }

  @Auth()
  @Get('me')
  @ApiOperation({ summary: 'Get the signed-in account' })
  async me(@CurrentUser('userId') userId: string) {
    const data = await this.authService.me(userId);
    return { ...data, __message: 'Account retrieved successfully' };
  }

  @Auth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the account password' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    const data = await this.authService.changePassword(userId, dto);
    return { ...data, __message: 'Password changed successfully' };
  }
}
