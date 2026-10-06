import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    console.log('[UsersService] create');

    const existingUser = await this.usersRepository.findByEmail(
      createUserDto.email,
    );

    if (existingUser) {
      throw new ConflictException('Email is already in use.');
    }

    try {
      return await this.usersRepository.save({
        email: createUserDto.email,
        name: createUserDto.name,
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already in use.');
      }

      throw error;
    }
  }

  async findOne(id: number): Promise<UserEntity> {
    console.log(`[UsersService] findOne(${id})`);

    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} was not found.`);
    }

    return user;
  }

  async findGenerationHistory(id: number): Promise<UserEntity> {
    console.log(`[UsersService] findGenerationHistory(${id})`);

    const user = await this.usersRepository.findWithGenerationHistory(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} was not found.`);
    }

    return user;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string };
    return driverError.code === '23505';
  }
}
