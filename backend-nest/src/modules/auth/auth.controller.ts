import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';

class GoogleLoginDto {
  idToken: string;
}

class RefreshDto {
  refreshToken: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('google')
  @ApiOperation({ summary: 'Login with Google ID token' })
  async google(@Body() dto: GoogleLoginDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
