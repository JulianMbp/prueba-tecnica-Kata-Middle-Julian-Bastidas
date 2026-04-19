import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateReleaseDto } from '../dto/create-release.dto';
import { ReleaseService } from './release.service';

@Controller('releases')
export class ReleaseController {
  constructor(private readonly releaseService: ReleaseService) {}

  @Post()
  create(@Body() dto: CreateReleaseDto) {
    return this.releaseService.create(dto);
  }

  @Get()
  findAll() {
    return this.releaseService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.releaseService.findOne(id);
  }

  @Patch(':id/approve')
  approveManually(@Param('id') id: string) {
    return this.releaseService.approveManually(id);
  }
}

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
