const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
const requestId = Number(process.argv[2]);
const requestCount = Number(process.argv[3] ?? 2);

if (!Number.isInteger(requestId) || requestId < 1) {
  throw new Error(
    'Usage: npm run test:concurrent-completion -- <generationRequestId> [requestCount]',
  );
}

const body = {
  results: [
    {
      mainCopy: '동시에 완료된 요청 중 하나만 저장되어야 합니다.',
      subCopy: 'Pessimistic row lock verification',
      model: 'lock-verification',
    },
  ],
};

const responses = await Promise.all(
  Array.from({ length: requestCount }, async () => {
    const response = await fetch(
      `${baseUrl}/generation-requests/${requestId}/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    return {
      status: response.status,
      body: await response.json(),
    };
  }),
);

const statusCounts = responses.reduce((counts, response) => {
  counts[response.status] = (counts[response.status] ?? 0) + 1;
  return counts;
}, {});

console.log(
  JSON.stringify(
    {
      requestId,
      requestCount,
      statusCounts,
      responses,
    },
    null,
    2,
  ),
);
