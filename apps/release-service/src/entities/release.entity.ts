import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('releases')
export class Release {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() fecha: Date;
  @Column() equipo: string;
  @Column() tipo: string;
  @Column() descripcion: string;
  @Column({ nullable: true }) prIdentifier: string;
  @Column({ type: 'float' }) cobertura: number;
  @Column('simple-json') stack: { framework: string; version: string }[];
  @Column({ default: 'pending' }) estado: string;
  @Column({ default: false }) aprobacionAutomatica: boolean;
  @Column({ nullable: true }) motivoRechazo: string;
  @Column() approverEmail: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
