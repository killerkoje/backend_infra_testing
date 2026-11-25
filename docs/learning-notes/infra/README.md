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

6. [Kubernetes 전체 구조와 현재 K3s 실습 환경](./06-kubernetes-big-picture.md)
   - Cluster·Control Plane·Node·Pod·Container의 큰 관계도
   - Scheduler의 Node 선택과 Node 내부 실행 흐름

7. [새 이미지 배포와 롤백 실습](./07-image-deploy-rollback.md)
   - 새 이미지 빌드·K3s 전달·배포
   - 외부 응답 확인과 이전 이미지 롤백

8. [Mac·K3s 실습 전체 기록](./08-macos-k3s-lab.md)
   - Linux·Pod 자동 복구·Service·EndpointSlice
   - Probe·DB 복구·PVC·Rolling Update·HPA
   - Ingress·Traefik·터널·로그·명령어 복습

9. [Cloud Run 배포·인증·트래픽 분할·오토스케일링](./09-cloud-run-lab.md)
   - Cloud Build와 Artifact Registry를 통한 자동 배포
   - ID 토큰 인증 호출, 요청 ID 추적 및 리비전 트래픽 분할
   - 동시 요청에 따른 확장, Cloud Monitoring 조회, GPU 인스턴스 개념

10. [Cloud Run CI/CD·스모크 테스트·5xx 알림](./10-cloud-run-cicd-observability.md)
    - CI 실패 차단, 0% 배포, 스모크 테스트와 100% 전환
    - 배포 후 요청 수·지연 시간, 5xx 이메일 알림 검증

## 다음 세션 시작점

[최근 Cloud Run 실습과 GHCR → K3s 계획](../../../LEARNING-NEXT.md)을 확인한다.
각 단계는 직접 실행한 결과를 확인한 후 다음으로 진행한다.

## 현재 위치

```text
Docker
→ Linux Process·Port·환경변수
→ Network·DNS·TCP·HTTP
→ WebSocket
→ Reverse Proxy·TLS
→ Minikube / Kubernetes
   └── Pod·Deployment·Service·Ingress·ConfigMap·Secret·Probe·Rolling Update 완료
→ Mac Ubuntu VM / K3s 배포 완료
→ Cloudflare HTTPS Tunnel 공개 완료
→ Pod 자동 복구·DB 장애 복구·HPA 1→3→1 검증 완료
→ 새 이미지 배포·롤백 완료
→ Cloud Build / Artifact Registry / Cloud Run 자동 배포 검증 완료
→ Cloud Run 리비전 분할·인스턴스 1 → 2 → 0 → 1 확인
→ Cloud Build 배포 전 테스트·배포 후 스모크 테스트·트래픽 자동 전환 확인
→ Cloud Monitoring 요청 지표·5xx 이메일 알림 확인
→ PostgreSQL 별도 볼륨 복원·WAL 시점 복구 확인
```
