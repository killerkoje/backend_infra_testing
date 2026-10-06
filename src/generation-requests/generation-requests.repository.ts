import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GenerationRequestEntity,
  GenerationRequestStatus,
} from './generation-request.entity';

export interface NewGenerationRequest {
  userId: number;
  prompt: string;
}

@Injectable()
export class GenerationRequestsRepository {
  constructor(
    @InjectRepository(GenerationRequestEntity)
    private readonly repository: Repository<GenerationRequestEntity>,
  ) {}

  findById(id: number): Promise<GenerationRequestEntity | null> {
    console.log(`[GenerationRequestsRepository] findById(${id})`);
    return this.repository.findOne({
      where: { id },
      relations: { user: true },
    });
  }

  save(input: NewGenerationRequest): Promise<GenerationRequestEntity> {
    console.log('[GenerationRequestsRepository] save');

    const entity = this.repository.create({
      ...input,
      status: GenerationRequestStatus.Pending,
    });

    return this.repository.save(entity);
  }
}
