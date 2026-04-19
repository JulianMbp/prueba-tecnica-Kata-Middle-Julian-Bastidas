export class FrameworkItemDto {
  framework: string;
  version: string;
}

export class CheckFrameworksDto {
  stack: FrameworkItemDto[];
}
