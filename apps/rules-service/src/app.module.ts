import { Module } from '@nestjs/common';
import { RulesController } from './rules/rules.controller';
import { RulesService } from './rules/rules.service';

@Module({
  controllers: [RulesController],
  providers: [RulesService],
})
export class AppModule {}
