import { Injectable } from '@nestjs/common';
import { FrameworkItemDto } from '../dto/check-frameworks.dto';
import { FrameworkCheckResultDto } from '../dto/framework-check-result.dto';

const NPM_PACKAGE_BY_FRAMEWORK: Record<string, string> = {
  react: 'react',
  angular: '@angular/core',
  vue: 'vue',
  nestjs: '@nestjs/core',
  'spring-boot': 'spring-boot',
  express: 'express',
  django: 'django',
  laravel: 'laravel',
  next: 'next',
  nuxt: 'nuxt',
};

@Injectable()
export class FrameworkExplorerService {
  async checkFrameworks(
    stack: FrameworkItemDto[],
  ): Promise<FrameworkCheckResultDto[]> {
    const supportedLocal = require('./supported-versions.json') as Record<
      string,
      string[]
    >;
    const results: FrameworkCheckResultDto[] = [];

    for (const item of stack) {
      const key = item.framework.toLowerCase();
      const major = item.version.split('.')[0];
      const majors = supportedLocal[key];

      if (majors?.includes(major)) {
        results.push({
          framework: item.framework,
          version: item.version,
          supported: true,
        });
        continue;
      }

      results.push(await this.checkNpmFallback(item));
    }

    return results;
  }

  private npmPackageName(framework: string): string {
    const k = framework.toLowerCase();
    return NPM_PACKAGE_BY_FRAMEWORK[k] ?? framework;
  }

  private async checkNpmFallback(
    item: FrameworkItemDto,
  ): Promise<FrameworkCheckResultDto> {
    const name = this.npmPackageName(item.framework);
    const encoded = encodeURIComponent(name);

    try {
      const res = await fetch(`https://registry.npmjs.org/${encoded}`);
      if (!res.ok) {
        return {
          framework: item.framework,
          version: item.version,
          supported: false,
          reason: 'No encontrado en catálogo local ni en el registro npm',
        };
      }
      const data = (await res.json()) as {
        versions?: Record<string, unknown>;
      };
      const versions = data.versions ?? {};
      if (versions[item.version] != null) {
        return {
          framework: item.framework,
          version: item.version,
          supported: true,
        };
      }
      return {
        framework: item.framework,
        version: item.version,
        supported: false,
        reason: 'Versión no publicada en npm (fallback)',
      };
    } catch {
      return {
        framework: item.framework,
        version: item.version,
        supported: false,
        reason: 'Error al consultar el registro npm',
      };
    }
  }
}
