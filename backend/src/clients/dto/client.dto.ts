import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(1, { message: 'Client name is required' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Client name cannot be empty' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** The client's sessions in their new order, as a complete list of ids. */
export class ReorderSessionsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Send the sessions in their new order' })
  @ArrayMaxSize(500)
  @IsString({ each: true })
  sessionIds!: string[];
}
