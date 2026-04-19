import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { ApprovalRule } from '../entities/approval-rule.entity';
import { Release } from '../entities/release.entity';

@Injectable()
export class ReleaseManager {
  constructor(
    private httpService: HttpService,
    @InjectRepository(ApprovalRule) private rulesRepo: Repository<ApprovalRule>,
  ) {}

  async process(release: Release): Promise<Partial<Release>> {
    if (release.tipo !== 'rs') {
      return { estado: 'approved', aprobacionAutomatica: false };
    }

    const activeRules = await this.rulesRepo.find({ where: { activa: true } });

    const { data } = await firstValueFrom(
      this.httpService.post(`${process.env.RULES_SERVICE_URL}/rules/evaluate`, {
        cobertura: release.cobertura,
        descripcion: release.descripcion,
        prIdentifier: release.prIdentifier,
        stack: release.stack,
        rules: activeRules,
      }),
    );

    if (data.passed) {
      return { estado: 'approved', aprobacionAutomatica: true };
    }

    return {
      estado: 'pending',
      aprobacionAutomatica: false,
      motivoRechazo: data.motivoRechazo,
    };
  }
}
