import { Module } from '@nestjs/common';
import { FrameworkExplorerService } from './frameworks/framework-explorer.service';
import { GithubService } from './github/github.service';
import { IntegrationController } from './integration.controller';

@Module({
  controllers: [IntegrationController],
  providers: [GithubService, FrameworkExplorerService],
})
export class AppModule {}
