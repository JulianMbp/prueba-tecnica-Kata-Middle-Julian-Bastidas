import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { RulesConfigService } from './rules-config.service';

@Controller('rules')
export class RulesConfigController {
  constructor(private readonly rulesConfigService: RulesConfigService) {}

  @Get()
  findAll() {
    return this.rulesConfigService.findAll();
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { activa?: boolean; config?: Record<string, any> },
  ) {
    return this.rulesConfigService.update(id, body);
  }
}
