import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MinLength(50, { message: 'That transcript looks too short to analyse' })
  transcript!: string;

  /**
   * Optional: when omitted the session is filed under a new client named from
   * `newClientName`, or "New client" if that is omitted too. This is what lets
   * a clinician paste a transcript before deciding how to organise anything.
   */
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  newClientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Session date must be a valid date' })
  sessionDate?: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Session title cannot be empty' })
  @MaxLength(200)
  title?: string;

  /** Setting this moves the session to another client. */
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Session date must be a valid date' })
  sessionDate?: string;
}

export class FollowUpDto {
  @IsString()
  @MinLength(3, { message: 'Ask a question about this session' })
  @MaxLength(2000)
  question!: string;
}
