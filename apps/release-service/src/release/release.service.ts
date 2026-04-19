import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { CreateReleaseDto } from '../dto/create-release.dto';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { Release } from '../entities/release.entity';
import { ReleaseManager } from './release.manager';

@Injectable()
export class ReleaseService {
  constructor(
    @InjectRepository(Release) private readonly releaseRepo: Repository<Release>,
    private readonly releaseManager: ReleaseManager,
    private readonly httpService: HttpService,
  ) {}

  async create(dto: CreateReleaseDto): Promise<Release> {
    const release = this.releaseRepo.create({
      fecha: new Date(dto.fecha),
      equipo: dto.equipo,
      tipo: dto.tipo,
      descripcion: dto.descripcion,
      prIdentifier: dto.prIdentifier,
      cobertura: dto.cobertura,
      stack: dto.stack,
      approverEmail: dto.approverEmail,
      estado: 'pending',
    });
    let saved = await this.releaseRepo.save(release);
    const result = await this.releaseManager.process(saved);
    Object.assign(saved, result);
    saved = await this.releaseRepo.save(saved);

    if (saved.estado === 'pending') {
      const payload: SendNotificationDto = {
        approverEmail: saved.approverEmail,
        equipo: saved.equipo,
        tipo: saved.tipo,
        descripcion: saved.descripcion,
        prIdentifier: saved.prIdentifier,
        motivoRechazo: saved.motivoRechazo ?? '',
        releaseId: saved.id,
      };
      const url = `${process.env.NOTIFICATION_SERVICE_URL}/notifications/email`;
      try {
        await firstValueFrom(this.httpService.post(url, payload));
      } catch (err) {
        console.error('Error calling notification-service:', err);
      }
    }

    return saved;
  }

  async findAll(): Promise<Release[]> {
    return this.releaseRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Release> {
    const release = await this.releaseRepo.findOne({ where: { id } });
    if (!release) {
      throw new NotFoundException();
    }
    return release;
  }

  async approveManually(id: string): Promise<Release> {
    const release = await this.findOne(id);
    release.estado = 'approved';
    release.aprobacionAutomatica = false;
    return this.releaseRepo.save(release);
  }
}
