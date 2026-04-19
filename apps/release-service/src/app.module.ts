import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Release } from './entities/release.entity';
import { ApprovalRule } from './entities/approval-rule.entity';
import { User } from './entities/user.entity';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { HealthController, ReleaseController } from './release/release.controller';
import { ReleaseManager } from './release/release.manager';
import { ReleaseService } from './release/release.service';
import { RulesConfigController } from './rules-config/rules-config.controller';
import { RulesConfigService } from './rules-config/rules-config.service';
import { SeedService } from './seed/seed.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH || './data/releases.db',
      entities: [Release, ApprovalRule, User],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, ApprovalRule, Release]),
    HttpModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRY },
    }),
  ],
  controllers: [
    AuthController,
    ReleaseController,
    HealthController,
    RulesConfigController,
  ],
  providers: [
    SeedService,
    AuthService,
    ReleaseService,
    ReleaseManager,
    RulesConfigService,
  ],
})
export class AppModule {}
