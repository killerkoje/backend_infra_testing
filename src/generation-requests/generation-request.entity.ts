import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GenerationResultEntity } from '../generation-results/generation-result.entity';
import { UserEntity } from '../users/user.entity';

export enum GenerationRequestStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
}

@Entity('generation_requests')
@Index('IDX_generation_requests_user_created_at', ['userId', 'createdAt'])
export class GenerationRequestEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @ManyToOne(() => UserEntity, (user) => user.generationRequests, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: GenerationRequestStatus.Pending,
  })
  status!: GenerationRequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @OneToMany(() => GenerationResultEntity, (result) => result.request)
  results!: GenerationResultEntity[];
}
