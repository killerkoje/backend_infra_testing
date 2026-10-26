import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  checkLiveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  async checkReadiness() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
