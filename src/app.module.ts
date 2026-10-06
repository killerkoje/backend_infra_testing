import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationRequestEntity } from './generation-requests/generation-request.entity';
import { GenerationRequestsModule } from './generation-requests/generation-requests.module';
import { GenerationResultEntity } from './generation-results/generation-result.entity';
import { UserEntity } from './users/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5433),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_DATABASE ?? 'backend_learning',
      entities: [UserEntity, GenerationRequestEntity, GenerationResultEntity],
      synchronize: false,
      logging: ['query', 'error'],
    }),
    UsersModule,
    GenerationRequestsModule,
  ],
})
export class AppModule {}
