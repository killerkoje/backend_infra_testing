import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { GenerationRequestEntity } from '../generation-requests/generation-request.entity';
import { GenerationResultEntity } from '../generation-results/generation-result.entity';
import { UserEntity } from '../users/user.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'backend_learning',
  entities: [UserEntity, GenerationRequestEntity, GenerationResultEntity],
  migrations: [`${__dirname}/migrations/*{.js,.ts}`],
  synchronize: false,
  logging: ['query', 'error'],
});
