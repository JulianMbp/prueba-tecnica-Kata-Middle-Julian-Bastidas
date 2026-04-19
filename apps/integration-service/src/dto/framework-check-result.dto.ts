export class FrameworkCheckResultDto {
  framework: string;
  version: string;
  supported: boolean;
  reason?: string;
}
