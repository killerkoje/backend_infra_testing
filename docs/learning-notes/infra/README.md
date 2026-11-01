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

4. [Minikube·Pod·Deployment·Service](./04-minikube-kubernetes-core.md)
   - Windows Minikube와 Linux Node
   - Pod와 kubectl port-forward
   - Service·Label·EndpointSlice
   - Deployment·ReplicaSet·Pod 자동 복구

5. [Kubernetes 설정·Probe·Rolling Update·종료](./05-kubernetes-config-rollout-lifecycle.md)
   - ConfigMap·Secret 반영 시점
   - CNI와 Pod Network 생성·정리
   - Readiness·Liveness와 Endpoint 전환
   - 무중단 Rolling Update와 Graceful Shutdown

## 현재 위치

```text
Docker
→ Linux Process·Port·환경변수
→ Network·DNS·TCP·HTTP
→ WebSocket
→ Reverse Proxy·TLS
→ Minikube / Kubernetes
   └── Pod·Deployment·Service·Ingress·ConfigMap·Secret·Probe·Rolling Update 완료
→ K3s 실제 서버 배포       ← 다음 단계
→ Cloudflare Tunnel
→ Observability
→ 장애 대응
```
