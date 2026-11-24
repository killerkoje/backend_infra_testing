import http from 'node:http';

const port = Number(process.env.PORT || 8080);

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    message: 'Hello from my app',
    environment: process.env.APP_ENV || 'unset',
    revision: process.env.K_REVISION || 'local',
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Demo server listening on port ${port}`);
});

process.on('SIGTERM', () => server.close());
