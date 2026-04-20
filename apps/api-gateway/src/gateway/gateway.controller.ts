import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateReleaseDto } from '../dto/create-release.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateRuleDto } from '../dto/update-rule.dto';
import { GatewayService } from './gateway.service';

@Controller('api')
export class GatewayController {
  constructor(private readonly gateway: GatewayService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiTags('release-service')
  @Post('auth/login')
  @ApiOperation({
    summary: 'Login',
    description:
      'Proxy a `POST /auth/login` del release-service. Devuelve `access_token` (JWT). Límite: 5 peticiones por minuto.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Token y datos de usuario' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { status, data } = await this.gateway.proxy({
      method: 'POST',
      path: '/auth/login',
      body: dto,
    });
    res.status(status).json(data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiTags('release-service')
  @Post('releases')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear release',
    description: 'Proxy a `POST /releases` del release-service.',
  })
  @ApiBody({ type: CreateReleaseDto })
  @ApiResponse({ status: 201, description: 'Release creado (o según backend)' })
  async createRelease(
    @Body() dto: CreateReleaseDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { status, data } = await this.gateway.proxy({
      method: 'POST',
      path: '/releases',
      body: dto,
      authorization: req.headers.authorization,
    });
    res.status(status).json(data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiTags('release-service')
  @Get('releases')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar releases',
    description: 'Proxy a `GET /releases`.',
  })
  async listReleases(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { status, data } = await this.gateway.proxy({
      method: 'GET',
      path: '/releases',
      authorization: req.headers.authorization,
    });
    res.status(status).json(data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiTags('release-service')
  @Get('releases/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener release por id' })
  @ApiParam({ name: 'id', description: 'UUID del release' })
  async getRelease(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { status, data } = await this.gateway.proxy({
      method: 'GET',
      path: `/releases/${id}`,
      authorization: req.headers.authorization,
    });
    res.status(status).json(data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiTags('integration-service')
  @Get('coverage/:owner/:repo/:prNumber')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cobertura desde GitHub Checks',
    description:
      'Proxy a `GET /integrations/coverage/:owner/:repo/:prNumber` del integration-service.',
  })
  @ApiParam({ name: 'owner', description: 'Propietario del repositorio' })
  @ApiParam({ name: 'repo', description: 'Nombre del repositorio' })
  @ApiParam({ name: 'prNumber', description: 'Número del PR' })
  async getCoverage(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Param('prNumber', ParseIntPipe) prNumber: number,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const path = `/integrations/coverage/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${prNumber}`;
    const { status, data } = await this.gateway.proxyIntegration({
      method: 'GET',
      path,
      authorization: req.headers.authorization,
    });
    res.status(status).json(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiTags('release-service')
  @Patch('releases/:id/approve')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Aprobar release manualmente',
    description: 'Solo rol **admin**. Proxy a `PATCH /releases/:id/approve`.',
  })
  @ApiParam({ name: 'id', description: 'UUID del release' })
  async approveRelease(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { status, data } = await this.gateway.proxy({
      method: 'PATCH',
      path: `/releases/${id}/approve`,
      authorization: req.headers.authorization,
    });
    res.status(status).json(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiTags('release-service')
  @Get('rules')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar reglas de aprobación',
    description: 'Solo **admin**. Proxy a `GET /rules`.',
  })
  async listRules(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { status, data } = await this.gateway.proxy({
      method: 'GET',
      path: '/rules',
      authorization: req.headers.authorization,
    });
    res.status(status).json(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiTags('release-service')
  @Patch('rules/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar regla',
    description: 'Solo **admin**. Proxy a `PATCH /rules/:id` (activa, config).',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID numérico de la regla' })
  @ApiBody({ type: UpdateRuleDto })
  async updateRule(
    @Param('id') id: string,
    @Body() body: UpdateRuleDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { status, data } = await this.gateway.proxy({
      method: 'PATCH',
      path: `/rules/${id}`,
      body,
      authorization: req.headers.authorization,
    });
    res.status(status).json(data);
  }
}
