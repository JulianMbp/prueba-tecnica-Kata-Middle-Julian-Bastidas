import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class FrameworkItemDto {
  @ApiProperty({ example: 'react' })
  @IsString()
  framework: string;

  @ApiProperty({ example: '18.2.0' })
  @IsString()
  version: string;
}

export class CreateReleaseDto {
  @ApiProperty({ example: '2026-04-19' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ example: 'Equipo A' })
  @IsString()
  @IsNotEmpty()
  equipo: string;

  @ApiProperty({ enum: ['rs', 'fx', 'cv'], example: 'rs' })
  @IsIn(['rs', 'fx', 'cv'])
  tipo: string;

  @ApiProperty({ example: 'Descripción del cambio' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiPropertyOptional({ example: 'org/repo#42' })
  @IsOptional()
  @IsString()
  prIdentifier?: string;

  @ApiProperty({ example: 85, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  cobertura: number;

  @ApiProperty({ type: [FrameworkItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameworkItemDto)
  stack: FrameworkItemDto[];

  @ApiProperty({ example: 'approver@empresa.com' })
  @IsEmail()
  approverEmail: string;
}
