import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { GenerationResultEntity } from '../generation-results/generation-result.entity';
import { GenerationRequestEntity } from './generation-request.entity';
import { GenerationRequestsController } from './generation-requests.controller';
import { GenerationRequestsRepository } from './generation-requests.repository';
import { GenerationRequestsService } from './generation-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GenerationRequestEntity,
      GenerationResultEntity,
    ]),
    UsersModule,
  ],
  controllers: [GenerationRequestsController],
  providers: [GenerationRequestsService, GenerationRequestsRepository],
})
export class GenerationRequestsModule {}
