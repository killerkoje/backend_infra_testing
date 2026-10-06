import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GenerationResultEntity } from '../generation-results/generation-result.entity';
import { UsersRepository } from '../users/users.repository';
import { CompleteGenerationRequestDto } from './dto/complete-generation-request.dto';
import { CreateGenerationRequestDto } from './dto/create-generation-request.dto';
import {
  GenerationRequestEntity,
  GenerationRequestStatus,
} from './generation-request.entity';
import { GenerationRequestsRepository } from './generation-requests.repository';

@Injectable()
export class GenerationRequestsService {
  constructor(
    private readonly generationRequestsRepository: GenerationRequestsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateGenerationRequestDto,
  ): Promise<GenerationRequestEntity> {
    console.log('[GenerationRequestsService] create');

    const user = await this.usersRepository.findById(dto.userId);

    if (!user) {
      throw new NotFoundException(`User with id ${dto.userId} was not found.`);
    }

    return this.generationRequestsRepository.save({
      userId: dto.userId,
      prompt: dto.prompt,
    });
  }

  async findOne(id: number): Promise<GenerationRequestEntity> {
    console.log(`[GenerationRequestsService] findOne(${id})`);

    const request = await this.generationRequestsRepository.findById(id);

    if (!request) {
      throw new NotFoundException(
        `Generation request with id ${id} was not found.`,
      );
    }

    return request;
  }

  async complete(id: number, dto: CompleteGenerationRequestDto) {
    console.log(`[GenerationRequestsService] complete(${id})`);

    return this.dataSource.transaction(async (manager) => {
      const requestsRepository = manager.getRepository(
        GenerationRequestEntity,
      );
      const resultsRepository = manager.getRepository(GenerationResultEntity);

      const request = await requestsRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(
          `Generation request with id ${id} was not found.`,
        );
      }

      if (request.status !== GenerationRequestStatus.Pending) {
        throw new ConflictException(
          `Generation request ${id} is already ${request.status}.`,
        );
      }

      const results = resultsRepository.create(
        dto.results.map((result) => ({
          requestId: id,
          mainCopy: result.mainCopy,
          subCopy: result.subCopy ?? null,
          model: result.model,
        })),
      );

      const savedResults = await resultsRepository.save(results);

      request.status = GenerationRequestStatus.Completed;
      await requestsRepository.save(request);

      return {
        requestId: request.id,
        status: request.status,
        results: savedResults,
      };
    });
  }
}
