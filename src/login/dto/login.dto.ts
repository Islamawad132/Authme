import { IsString, IsOptional, Matches } from 'class-validator';

const NO_HTML = /^[^<>]*$/;
const NO_HTML_MSG = 'must not contain HTML tags';

export class LoginDto {
  @IsString()
  @Matches(NO_HTML, { message: `username ${NO_HTML_MSG}` })
  username!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  csrf_token?: string;

  // Allow extra OAuth redirect fields to pass through
  [key: string]: unknown;
}

export class TotpDto {
  @IsString()
  @Matches(/^\d{6,8}$/, { message: 'OTP code must be 6-8 digits' })
  otp_code!: string;

  @IsOptional()
  @IsString()
  session_id?: string;

  @IsOptional()
  @IsString()
  csrf_token?: string;

  [key: string]: unknown;
}

export class ChangePasswordDto {
  @IsString()
  current_password!: string;

  @IsString()
  new_password!: string;

  @IsOptional()
  @IsString()
  csrf_token?: string;

  [key: string]: unknown;
}

export class ForgotPasswordDto {
  @IsString()
  @Matches(NO_HTML, { message: `email ${NO_HTML_MSG}` })
  email!: string;

  @IsOptional()
  @IsString()
  csrf_token?: string;

  [key: string]: unknown;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  new_password!: string;

  @IsOptional()
  @IsString()
  csrf_token?: string;

  [key: string]: unknown;
}
