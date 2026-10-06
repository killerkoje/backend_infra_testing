import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class GenerationResultInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mainCopy!: string;

  @IsOptional()
  @IsString()
  subCopy?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model!: string;
}

export class CompleteGenerationRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GenerationResultInputDto)
  results!: GenerationResultInputDto[];
}
