import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { ApprovalRule } from '../entities/approval-rule.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ApprovalRule)
    private readonly rulesRepo: Repository<ApprovalRule>,
  ) {}

  async onModuleInit(): Promise<void> {
    if ((await this.userRepo.count()) === 0) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminPassword != null && adminEmail != null) {
        const hash = await bcrypt.hash(adminPassword, 12);
        await this.userRepo.save({
          email: adminEmail,
          password: hash,
          role: 'admin',
          equipo: 'Platform',
        });
      }
    }

    if ((await this.rulesRepo.count()) === 0) {
      await this.rulesRepo.save([
        {
          nombre: 'min_coverage',
          descripcion: 'Cobertura mínima de pruebas',
          activa: true,
          config: { minCoverage: 80 },
        },
        {
          nombre: 'require_pr',
          descripcion: 'Requiere PR o historia JIRA',
          activa: true,
          config: {},
        },
        {
          nombre: 'check_obsolescence',
          descripcion: 'Verifica obsolescencia de frameworks',
          activa: true,
          config: {},
        },
      ]);
    }
  }
}
