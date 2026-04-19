import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('approval_rules')
export class ApprovalRule {
  @PrimaryGeneratedColumn() id: number;
  @Column() nombre: string;
  @Column() descripcion: string;
  @Column({ default: true }) activa: boolean;
  @Column('simple-json', { nullable: true }) config: Record<string, any>;
  @UpdateDateColumn() updatedAt: Date;
}
