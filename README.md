# Backend Infrastructure Learning

NestJS, PostgreSQL, Docker, Kubernetes를 직접 구성하고 장애 상황을 검증하면서 기록한 백엔드·인프라 학습 저장소다.

## 주제별 폴더

### Backend

- [백엔드 요청 흐름](./docs/learning-notes/backend/01-request-flow.md)
- [DTO·Service·Repository·Entity·TypeORM](./docs/learning-notes/backend/02-data-layers.md)
- [비동기와 성능](./docs/learning-notes/backend/03-async-and-performance.md)
- [Queue·Worker·ACK](./docs/learning-notes/backend/04-queue-worker-ack.md)
- [HTTP와 WebSocket](./docs/learning-notes/backend/05-http-and-websocket.md)

### Database

- [DB 핵심 개념](./docs/learning-notes/database/01-database-core.md)
- [Transaction·Lock·Deadlock·Isolation](./docs/learning-notes/database/02-transaction-lock-isolation.md)

### Software Design

- [DDD와 ERD: 백엔드 설계 개념](./docs/learning-notes/design/01-ddd-erd-backend-design.md)

### Docker

- [Docker 핵심 개념](./docs/learning-notes/docker/01-docker-core.md)
- [Docker Compose와 현재 프로젝트](./docs/learning-notes/docker/02-compose-project.md)

### Infra

- [Linux 실행 환경](./docs/learning-notes/infra/01-linux-runtime.md)
- [Network·HTTP·WebSocket](./docs/learning-notes/infra/02-network-http-websocket.md)
- [Reverse Proxy·Nginx·TLS](./docs/learning-notes/infra/03-reverse-proxy-tls.md)
- [Minikube·Pod·Deployment·Service](./docs/learning-notes/infra/04-minikube-kubernetes-core.md)

## 현재 학습 진도

```text
Backend Request Lifecycle       완료
PostgreSQL / DB 설계            완료
TypeORM                         완료
Transaction / Lock / 동시성     완료
Docker                          완료
Linux / Network                 Reverse Proxy·TLS까지 학습
Minikube / Kubernetes           PVC·Probe·Resources·HPA·Ingress까지 실습
실제 서버 배포                  예정
Observability / 장애 대응       예정
```

## 현재 프로젝트 실행 구조

```text
Client
→ NestJS Controller
→ UsersService
→ UsersRepository
→ TypeORM
→ PostgreSQL
```

현재 로컬 포트:

```text
NestJS 학습 API → 3001
PostgreSQL       → 5433
```

기존에 사용 중인 `3000`, `8000` 포트의 서버는 건드리지 않는다.

현재 `docker-compose.yml`은 PostgreSQL만 컨테이너로 실행한다. NestJS까지 Compose로 실행하는 구성은 아직 구현 전이다.

---

# Kubernetes 통합 실습 기록

## 최종 구성

이번 실습에서는 Minikube에 NestJS와 PostgreSQL을 배포하고 다음 흐름을 구성했다.

```text
Windows 개발 환경
→ Ingress Controller
→ Ingress 규칙
→ Backend Service
→ Ready Backend Pod
→ PostgreSQL Service
→ PostgreSQL Pod
→ PVC
```

관련 선언 파일은 `k8s/learning`에 모아두었다.

```text
k8s/learning
├── backend.yaml
├── backend-hpa.yaml
├── backend-ingress.yaml
├── postgres.yaml
├── postgres-pvc.yaml
├── nginx.yaml
├── configmap.yaml
├── secret.yaml
├── memory-stress.yaml
└── metrics-server-insecure-tls.patch.json
```

## Deployment·ReplicaSet·Pod

`replicas`는 클러스터 전체가 아니라 해당 Deployment가 유지할 Pod 수다.

```text
nginx-deployment replicas=3
→ Nginx Pod 3개 유지

postgres-deployment replicas=1
→ PostgreSQL Pod 1개 유지
```

Pod를 삭제하면 ReplicaSet이 실제 상태와 원하는 상태의 차이를 감지해 새 Pod를 생성한다.

```text
Deployment
→ ReplicaSet
→ Pod
→ Container
→ Application Process
```

단독 Pod에는 Deployment와 ReplicaSet이 없으므로 삭제 후 자동 복구되지 않는다.

## Service·Label·EndpointSlice

Service는 고정된 ClusterIP와 DNS를 제공하고 Label Selector가 일치하는 Pod를 찾는다.

```text
postgres-service
→ selector: app=postgres
→ Ready PostgreSQL Pod IP:5432
```

Backend는 바뀔 수 있는 Pod IP 대신 다음 주소를 사용한다.

```text
postgres-service:5432
```

Pod가 교체되면 EndpointSlice가 새 IP와 Ready 상태를 반영한다.

```yaml
endpoints:
  - addresses: [10.244.0.21]
    conditions:
      ready: true
  - addresses: [10.244.0.23]
    conditions:
      ready: false
```

`ready: false` Endpoint는 기록은 유지되지만 일반적인 Service 트래픽 대상에서는 제외된다.

## Docker 이미지와 Minikube containerd

Docker Desktop과 Minikube Node의 containerd는 별도 이미지 저장소를 사용한다.

```text
Docker Desktop image store
≠
Minikube containerd image store
```

초기에는 이미지 전달 과정을 직접 확인했다.

```text
docker build
→ docker image save로 TAR 생성
→ docker cp로 Minikube Node에 복사
→ ctr -n k8s.io images import
```

TAR는 소스 폴더가 아니라 이미지 레이어와 실행 설정을 운반하는 묶음이다. 이후에는 Minikube CLI로 이 과정을 단축했다.

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" `
  image build `
  -t backend-infra-testing:health-v1 `
  .
```

새 이미지 태그를 사용하면 Deployment의 Pod Template이 바뀌어 Rolling Update가 확실히 발생한다.

## PostgreSQL Service·PVC·영속성

PostgreSQL 데이터 디렉터리는 PVC에 연결했다.

```text
PostgreSQL Container
→ /var/lib/postgresql/data
→ postgres-data PVC
→ PV
```

검증 순서:

1. `users` 테이블에 사용자 저장
2. PostgreSQL Pod 삭제 또는 `replicas=0` 적용
3. `replicas=1` 복구
4. 새 PostgreSQL Pod가 기존 PVC 재마운트
5. 기존 사용자 조회

검증 결과:

```text
1 | k8s-user@example.com | Kubernetes User
```

Pod와 컨테이너가 사라져도 PVC가 유지되면 데이터는 남는다. PVC까지 삭제하면 PV의 Reclaim Policy에 따라 데이터가 삭제될 수 있다.

## NestJS·TypeORM·마이그레이션

Backend Pod는 ConfigMap과 Secret으로 DB 설정을 받는다.

```text
DB_HOST=postgres-service
DB_PORT=5432
DB_USERNAME=postgres
DB_DATABASE=study
DB_PASSWORD=<Secret에서 주입>
```

TypeORM 로그에서 연결과 SQL 실행을 확인했다.

```text
SELECT version()
SELECT * FROM current_schema()
START TRANSACTION
INSERT INTO users ...
COMMIT
```

마이그레이션으로 생성된 테이블:

```text
users
generation_requests
generation_results
migrations
persistence_test
```

## Port Forward와 Ingress

Backend Service에 대한 port-forward는 로컬 개발자용 임시 통로다.

```text
Windows localhost:3002
→ kubectl port-forward
→ 선택된 Backend Pod:3000
```

Ingress 경로는 다음과 다르다.

```text
외부 HTTP 요청
→ Ingress Controller
→ Host/Path 기반 Ingress 규칙
→ backend-service:3000
→ Ready Backend Pod
```

현재 규칙:

```text
Host: backend.local
Path: /
Backend: backend-service:3000
Ingress Address: 192.168.49.2
```

Windows Docker Driver 환경에서 `192.168.49.2:80` 직접 접근은 Timeout이 발생했다. 이는 Ingress 내부 라우팅과 별개인 Windows→Minikube Node 진입 경로 문제다.

Ingress 내부 라우팅은 다음처럼 검증할 수 있다.

```powershell
.\kubectl.exe port-forward `
  -n ingress-nginx `
  service/ingress-nginx-controller `
  8080:80

curl.exe -H "Host: backend.local" http://localhost:8080/health/live
```

Node IP 직접 접근은 `minikube tunnel` 같은 추가 진입 경로를 구성한다.

## Readiness와 Liveness

검사 목적과 검사 방법은 별개다.

```text
검사 목적
├── Readiness: 지금 트래픽을 받아도 되는가?
└── Liveness: 컨테이너를 재시작해야 하는가?

검사 방법
├── tcpSocket
├── httpGet
└── exec
```

초기 TCP Probe를 다음 HTTP Health API로 개선했다.

```text
GET /health/live
→ NestJS 프로세스가 HTTP 요청에 응답하는지 확인

GET /health/ready
→ PostgreSQL에 SELECT 1 실행
→ 성공하면 200
→ 실패하면 503 또는 Probe Timeout
```

Readiness 실패:

```text
Pod Status: Running
Ready: false
Service Endpoint에서 제외
컨테이너 재시작 없음
```

Liveness 실패:

```text
kubelet이 반복 실패 감지
→ containerd에 컨테이너 종료 요청
→ 같은 Pod 안에서 컨테이너 재생성
→ Restart Count 증가
```

Liveness 실패는 Pod 재생성이 아니다. Pod 이름은 유지되고 Container ID와 프로세스가 바뀐다.

## DB 장애와 자동 복구

PostgreSQL Deployment를 0개로 축소해 외부 의존성 장애를 만들었다.

```powershell
.\kubectl.exe scale deployment postgres-deployment --replicas=0
```

관찰 결과:

```text
PostgreSQL Pod: 0개
Backend Pod: Running
Backend Ready: false
Backend Restart Count: 0
```

Events에는 다음 내용이 기록됐다.

```text
Readiness probe failed
context deadline exceeded
Client.Timeout exceeded while awaiting headers
```

PostgreSQL을 1개로 복구하자 Service Endpoint와 DB 연결이 살아났고 Backend도 자동으로 `Ready=true`로 돌아왔다. DB 같은 외부 의존성을 Liveness에 넣어 전체 Backend를 재시작하지 않고, Readiness로 트래픽만 차단해야 하는 이유를 확인했다.

## Requests·Limits·QoS

Backend 자원 정책:

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

```text
requests
→ Scheduler 배치 기준
→ HPA CPU 사용률 계산 기준

limits
→ 컨테이너 최대 자원
→ CPU 초과 시 Throttling
→ Memory 초과 시 OOMKilled 가능
```

QoS:

```text
BestEffort: resources 설정 없음
Burstable: request/limit 일부 설정 또는 값이 다름
Guaranteed: 모든 컨테이너의 CPU·Memory request와 limit이 같음
```

Backend는 `Burstable`로 바뀌었다.

## OOMKilled·CrashLoopBackOff

`memory-stress` Pod는 memory limit `64Mi` 아래에서 0.5초마다 10Mi를 할당했다.

```text
Running
→ Memory limit 초과
→ Linux Kernel이 OOMKilled
→ kubelet이 컨테이너 재시작
→ 반복 장애 시 CrashLoopBackOff
```

관찰 결과:

```text
Reason: OOMKilled
Exit Code: 137
Restart Count 증가
Back-off restarting failed container
```

`137`은 일반적으로 `128 + SIGKILL(9)`이다. `CrashLoopBackOff`는 장애 원인이 아니라 반복 재시작 사이의 대기 상태다.

## Metrics Server

설치 전 오류:

```text
error: Metrics API not available
```

설치 후 Minikube kubelet 인증서의 IP SAN 문제로 수집이 실패했다.

```text
x509: cannot validate certificate for 192.168.49.2
because it doesn't contain any IP SANs
```

로컬 실습에서만 `--kubelet-insecure-tls`를 추가했다. HTTPS 암호화가 아니라 인증서 신원 검증을 생략하는 옵션이므로 운영 환경에서는 올바른 인증서를 사용해야 한다.

복구 후 지표:

```text
Minikube CPU:      187m
Minikube Memory:   982Mi
Backend CPU:         1m
Backend Memory:     48Mi
PostgreSQL CPU:      1m
PostgreSQL Memory:  29Mi
```

## HPA

설정:

```text
대상: backend-deployment
minReplicas: 1
maxReplicas: 5
CPU target: request 대비 평균 50%
```

CPU 사용률:

```text
현재 CPU 사용량 ÷ CPU request × 100
```

Backend의 request는 `100m`, limit은 `500m`이므로 limit까지 사용하면 HPA 기준 약 `500%`다.

부하 실습 결과:

```text
CPU 1%   / 목표 50% → replicas 1
CPU 230% / 목표 50% → Scale Up 판단
CPU 500% / 목표 50% → replicas 4
CPU 478% / 목표 50% → replicas 5
CPU 127% → 104% → 101% → 100%
```

HPA Events:

```text
SuccessfulRescale: New size 4
SuccessfulRescale: New size 5
reason: cpu resource utilization above target
```

HPA는 Pod를 직접 만들지 않는다.

```text
Metrics Server
→ HPA Controller가 필요한 replicas 계산
→ Deployment의 replicas 변경
→ ReplicaSet이 Pod 생성·삭제
```

부하가 사라지면 Scale Down 안정화 시간 후 `minReplicas=1`까지 줄어든다.

## 주요 확인 명령

```powershell
.\kubectl.exe get pods -o wide
.\kubectl.exe get services
.\kubectl.exe get endpointslice -o wide
.\kubectl.exe describe pod -l app=backend
.\kubectl.exe logs deployment/backend-deployment
.\kubectl.exe logs <pod-name> --previous
.\kubectl.exe top nodes
.\kubectl.exe top pods
.\kubectl.exe get hpa
.\kubectl.exe describe hpa backend-hpa
.\kubectl.exe get ingress
.\kubectl.exe describe ingress backend-ingress
```

## 운영 주의점과 다음 학습

- 학습용 Secret YAML의 평문 값은 운영에서 사용하지 않는다.
- `--kubelet-insecure-tls`는 로컬 Minikube 실습에만 사용한다.
- PostgreSQL replicas를 단순히 늘려 같은 RWO PVC에 연결하지 않는다.
- HPA가 적용된 Deployment의 replicas를 사람이 바꿔도 HPA가 다시 덮어쓸 수 있다.
- 다음 단계는 Windows→Ingress 진입 경로, TLS, ConfigMap·Secret 갱신, Observability다.
