import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateGenerationResults1790730003000
  implements MigrationInterface
{
  name = 'CreateGenerationResults1790730003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'generation_results',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'request_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'main_copy',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'sub_copy',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'model',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'generation_results',
      new TableForeignKey({
        name: 'FK_generation_results_request',
        columnNames: ['request_id'],
        referencedTableName: 'generation_requests',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex(
      'generation_results',
      new TableIndex({
        name: 'IDX_generation_results_request_id',
        columnNames: ['request_id'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('generation_results');
  }
}
