import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const project = 'mineral-brand-515105-e3';
const account = '1056202155531-compute@developer.gserviceaccount.com';
const page = `<!doctype html>
<html lang="ko"><meta charset="utf-8"><title>Cloud Run 호출 테스트</title>
<button id="hello">Hello</button><pre id="result" aria-live="polite"></pre>
<script>
const button = document.querySelector('#hello');
const result = document.querySelector('#result');
button.onclick = async () => {
  button.disabled = true;
  result.textContent = '호출 중…';
  try {
    const response = await fetch('/api/hello');
    const id = response.headers.get('X-Request-ID') || '없음';
    result.textContent = 'HTTP ' + response.status + '\\n요청 ID: ' + id + '\\n' + await response.text();
  } catch {
    result.textContent = '로컬 서버에 연결하지 못했어요.';
  } finally {
    button.disabled = false;
  }
};
</script></html>`;

async function gcloud(...args) {
  const command = process.platform === 'win32' ? 'powershell.exe' : 'gcloud';
  const commandArgs = process.platform === 'win32'
    ? ['-NoProfile', '-Command', 'gcloud ' + args.map(arg => "'" + arg.replaceAll("'", "''") + "'").join(' ')]
    : args;
  const { stdout } = await run(command, commandArgs, { timeout: 30_000 });
  return stdout.trim();
}

http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' || !['/', '/api/hello'].includes(req.url)) {
    res.writeHead(404).end();
    return;
  }
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
    return;
  }
  const requestId = randomUUID();
  res.setHeader('X-Request-ID', requestId);
  try {
    const url = await gcloud('run', 'services', 'describe', 'hello',
      '--region=asia-northeast3', `--project=${project}`, '--format=value(status.url)');
    const token = await gcloud('auth', 'print-identity-token',
      `--impersonate-service-account=${account}`, `--audiences=${url}`, '--include-email');
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-Request-ID': requestId },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    const body = await upstream.text();
    console.log(`GET /api/hello → Cloud Run HTTP ${upstream.status} requestId=${requestId}`);
    res.writeHead(upstream.status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(body);
  } catch (error) {
    console.error(error.stderr?.trim() || error.message);
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('Cloud Run 호출에 실패했어요. 로컬 서버 로그를 확인하세요.');
  }
}).listen(3000, '127.0.0.1', () => console.log('http://127.0.0.1:3000'));
