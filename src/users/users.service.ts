import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

    return await this.usersRepository.save({
      email: createUserDto.email,
      name: createUserDto.name,
    });
  }

  async findOne(id: number): Promise<UserEntity> {
    console.log(`[UsersService] findOne(${id})`);

    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} was not found.`);
    }

    return user;
  }
}
