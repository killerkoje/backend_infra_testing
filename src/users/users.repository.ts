import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export type NewUser = Omit<UserEntity, 'id'>;

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

  save(newUser: NewUser): Promise<UserEntity> {
    console.log('[UsersRepository] save');

    const entity = this.repository.create(newUser);
    return this.repository.save(entity);
  }
}
