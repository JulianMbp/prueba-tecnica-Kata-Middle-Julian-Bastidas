import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRule } from '../entities/approval-rule.entity';

@Injectable()
export class RulesConfigService {
  constructor(
    @InjectRepository(ApprovalRule) private readonly rulesRepo: Repository<ApprovalRule>,
  ) {}

  findAll(): Promise<ApprovalRule[]> {
    return this.rulesRepo.find();
  }

  async update(
    id: number,
    patch: { activa?: boolean; config?: Record<string, any> },
  ): Promise<ApprovalRule> {
    const rule = await this.rulesRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException();
    }
    if (patch.activa !== undefined) {
      rule.activa = patch.activa;
    }
    if (patch.config !== undefined) {
      rule.config = patch.config;
    }
    return this.rulesRepo.save(rule);
  }
}
