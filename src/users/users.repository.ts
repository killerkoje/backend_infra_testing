import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export type NewUser = Pick<UserEntity, 'email' | 'name'>;

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  findById(id: number): Promise<UserEntity | null> {
    console.log(`[UsersRepository] findById(${id})`);
    return this.repository.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    console.log(`[UsersRepository] findByEmail(${email})`);
    return this.repository.findOne({ where: { email } });
  }

  findWithGenerationHistory(id: number): Promise<UserEntity | null> {
    console.log(`[UsersRepository] findWithGenerationHistory(${id})`);

    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.generationRequests', 'generationRequest')
      .leftJoinAndSelect('generationRequest.results', 'generationResult')
      .where('user.id = :id', { id })
      .orderBy('generationRequest.createdAt', 'DESC')
      .addOrderBy('generationResult.createdAt', 'ASC')
      .getOne();
  }

  save(newUser: NewUser): Promise<UserEntity> {
    console.log('[UsersRepository] save');

    const entity = this.repository.create(newUser);
    return this.repository.save(entity);
  }
}
