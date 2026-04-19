import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({
    example: { minCoverage: 80 },
    description: 'Configuración JSON de la regla',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
