const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
const email = process.argv[2] ?? `concurrent-${Date.now()}@example.com`;
const requestCount = Number(process.argv[3] ?? 10);

const body = {
  email,
  name: 'Concurrent User',
};

const results = await Promise.all(
  Array.from({ length: requestCount }, async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }),
);

const statusCounts = results.reduce((counts, result) => {
  counts[result.status] = (counts[result.status] ?? 0) + 1;
  return counts;
}, {});

console.log(
  JSON.stringify(
    {
      email,
      requestCount,
      statusCounts,
      results,
    },
    null,
    2,
  ),
);
