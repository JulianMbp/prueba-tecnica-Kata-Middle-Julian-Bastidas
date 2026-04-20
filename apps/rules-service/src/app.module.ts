import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { RulesController } from './rules/rules.controller';
import { RulesService } from './rules/rules.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
    }),
  ],
  controllers: [RulesController],
  providers: [RulesService],
})
export class AppModule {}
