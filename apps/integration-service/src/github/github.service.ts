import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { PrValidationResultDto } from '../dto/pr-validation-result.dto';

@Injectable()
export class GithubService {
  private readonly octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async validatePR(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<PrValidationResultDto> {
    try {
      const { data } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      return {
        exists: true,
        title: data.title,
        state: data.state,
        merged: data.merged_at != null,
      };
    } catch {
      return { exists: false };
    }
  }
}
