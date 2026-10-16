# Infra 학습 노트

애플리케이션이 실제로 실행되고 Network를 통해 외부 요청을 받는 흐름을 정리한다.

## 문서

1. [Linux 실행 환경](./01-linux-runtime.md)
   - Process, Port, Environment Variable
   - Permission, Log, CPU, Memory, Disk

2. [Network·HTTP·WebSocket](./02-network-http-websocket.md)
   - IP, Port, DNS, TCP
   - HTTP와 HTTPS
   - WebSocket Upgrade와 연결 유지

3. [Reverse Proxy·Nginx·TLS](./03-reverse-proxy-tls.md)
   - 외부 요청을 내부 Backend로 전달
   - WebSocket Proxy 설정
   - TLS Termination과 Forwarded Header

## 현재 위치

```text
Docker
→ Linux Process·Port·환경변수
→ Network·DNS·TCP·HTTP
→ WebSocket
→ Reverse Proxy·TLS       ← 현재 학습 범위
→ 실제 서버 배포          ← 다음 단계
→ K3s / Kubernetes
→ Cloudflare Tunnel
→ Observability
→ 장애 대응
```
