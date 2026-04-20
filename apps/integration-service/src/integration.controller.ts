import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CheckFrameworksDto } from './dto/check-frameworks.dto';
import { FrameworkExplorerService } from './frameworks/framework-explorer.service';
import { GithubService } from './github/github.service';

@Controller('integrations')
export class IntegrationController {
  constructor(
    private readonly githubService: GithubService,
    private readonly frameworkExplorerService: FrameworkExplorerService,
  ) {}

  @Get('pr/:owner/:repo/:prNumber')
  validatePR(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Param('prNumber', ParseIntPipe) prNumber: number,
  ) {
    return this.githubService.validatePR(owner, repo, prNumber);
  }

  @Get('coverage/:owner/:repo/:prNumber')
  getCoverage(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Param('prNumber', ParseIntPipe) prNumber: number,
  ) {
    return this.githubService.getCoverage(owner, repo, prNumber);
  }

  @Post('frameworks/check')
  checkFrameworks(@Body() body: CheckFrameworksDto) {
    return this.frameworkExplorerService.checkFrameworks(body.stack);
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
