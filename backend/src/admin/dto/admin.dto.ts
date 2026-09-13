import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePromptConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'The analysis prompt is too short to be useful' })
  @MaxLength(20000)
  analysisPrompt?: string;

  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'The follow-up prompt is too short to be useful' })
  @MaxLength(20000)
  followUpPrompt?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(64000)
  maxTokens?: number;
}
