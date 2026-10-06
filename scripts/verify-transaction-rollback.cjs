const dataSource = require('../dist/database/data-source').default;
const {
  GenerationResultEntity,
} = require('../dist/generation-results/generation-result.entity');
const {
  GenerationRequestEntity,
} = require('../dist/generation-requests/generation-request.entity');

const requestId = Number(process.argv[2]);

if (!Number.isInteger(requestId) || requestId < 1) {
  throw new Error(
    'Usage: npm run test:transaction-rollback -- <generationRequestId>',
  );
}

async function run() {
  await dataSource.initialize();

  try {
    const resultsRepository = dataSource.getRepository(GenerationResultEntity);
    const requestsRepository = dataSource.getRepository(
      GenerationRequestEntity,
    );

    const beforeCount = await resultsRepository.count({
      where: { requestId },
    });

    try {
      await dataSource.transaction(async (manager) => {
        const transactionResultsRepository = manager.getRepository(
          GenerationResultEntity,
        );

        const result = transactionResultsRepository.create({
          requestId,
          mainCopy: 'THIS_RESULT_MUST_BE_ROLLED_BACK',
          subCopy: null,
          model: 'rollback-verification',
        });

        await transactionResultsRepository.save(result);
        throw new Error('Intentional failure after INSERT');
      });
    } catch (error) {
      console.log(`EXPECTED_ERROR=${error.message}`);
    }

    const afterCount = await resultsRepository.count({
      where: { requestId },
    });
    const request = await requestsRepository.findOne({
      where: { id: requestId },
    });

    console.log(
      JSON.stringify(
        {
          requestId,
          beforeCount,
          afterCount,
          rolledBack: beforeCount === afterCount,
          requestStatus: request?.status ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
