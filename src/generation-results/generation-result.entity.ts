import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GenerationRequestEntity } from '../generation-requests/generation-request.entity';

@Entity('generation_results')
@Index('IDX_generation_results_request_id', ['requestId'])
export class GenerationResultEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'request_id', type: 'int' })
  requestId!: number;

  @ManyToOne(() => GenerationRequestEntity, (request) => request.results, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'request_id' })
  request!: GenerationRequestEntity;

  @Column({ name: 'main_copy', type: 'varchar', length: 255 })
  mainCopy!: string;

  @Column({ name: 'sub_copy', type: 'text', nullable: true })
  subCopy!: string | null;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
