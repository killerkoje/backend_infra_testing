import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    console.log('[UsersController] POST /users');
    return this.usersService.create(createUserDto);
  }

  @Get(':id/generation-requests')
  findGenerationHistory(@Param('id', ParseIntPipe) id: number) {
    console.log(
      `[UsersController] GET /users/${id}/generation-requests`,
    );
    return this.usersService.findGenerationHistory(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    console.log(`[UsersController] GET /users/${id}`);
    return this.usersService.findOne(id);
  }
}
