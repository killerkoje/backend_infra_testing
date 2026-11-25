import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  console.log(JSON.stringify({
    message: `${req.method} ${req.url}`,
    requestId: req.headers['x-request-id'] || null,
  }));

  if (req.method === 'GET' && req.url.split('?')[0] === '/slow') {
    await delay(3000);
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    message: 'Hello from my app',
    environment: process.env.APP_ENV || 'unset',
    revision: process.env.K_REVISION || 'local',
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Demo server listening on port ${server.address().port}`);
});

process.on('SIGTERM', () => server.close());
