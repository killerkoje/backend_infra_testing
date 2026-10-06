import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateGenerationRequestDto {
  @IsInt()
  @Min(1)
  userId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt!: string;
}
