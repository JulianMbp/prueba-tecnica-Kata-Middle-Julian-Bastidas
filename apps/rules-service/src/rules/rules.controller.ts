import { Body, Controller, Post } from '@nestjs/common';
import { EvaluateRulesDto } from '../dto/evaluate-rules.dto';
import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post('evaluate')
  evaluate(@Body() dto: EvaluateRulesDto) {
    return this.rulesService.evaluate(dto);
  }
}
