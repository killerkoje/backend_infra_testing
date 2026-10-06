import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CompleteGenerationRequestDto } from './dto/complete-generation-request.dto';
import { CreateGenerationRequestDto } from './dto/create-generation-request.dto';
import { GenerationRequestsService } from './generation-requests.service';

@Controller('generation-requests')
export class GenerationRequestsController {
  constructor(
    private readonly generationRequestsService: GenerationRequestsService,
  ) {}

  @Post()
  create(@Body() dto: CreateGenerationRequestDto) {
    console.log('[GenerationRequestsController] POST /generation-requests');
    return this.generationRequestsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    console.log(`[GenerationRequestsController] GET /generation-requests/${id}`);
    return this.generationRequestsService.findOne(id);
  }

  @Post(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteGenerationRequestDto,
  ) {
    console.log(
      `[GenerationRequestsController] POST /generation-requests/${id}/complete`,
    );
    return this.generationRequestsService.complete(id, dto);
  }
}
