import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserCreatedAt1790730001000 implements MigrationInterface {
  name = 'AddUserCreatedAt1790730001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'created_at')) {
      return;
    }

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'created_at',
        type: 'timestamp',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'created_at')) {
      await queryRunner.dropColumn('users', 'created_at');
    }
  }
}
