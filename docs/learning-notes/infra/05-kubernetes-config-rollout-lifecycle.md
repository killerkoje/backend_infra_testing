# Kubernetes 설정·Probe·Rolling Update·종료

이 문서는 Minikube에서 ConfigMap·Secret 반영 시점부터 새 Pod의 Network 생성, Service Endpoint 전환, 기존 Pod의 안전한 종료까지 직접 검증한 결과를 정리한다.

## 전체 흐름

```text
ConfigMap·Secret 변경
→ 기존 Container 환경변수는 그대로
→ Deployment Rolling Update 실행
→ 새 Pod 생성
→ CNI가 새 Pod Network와 IP 구성
→ Container 시작
→ Readiness Probe 통과
→ Service EndpointSlice에 새 Pod IP 등록
→ 기존 Pod를 Ready=false로 전환
→ 기존 Pod IP를 Traffic 대상에서 제외
→ SIGTERM 전달
→ 진행 중 요청 완료
→ Container와 Pod Network 정리
```

관리 경로와 통신 경로는 구분한다.

```text
관리 경로
Deployment → ReplicaSet → Pod 생성·교체

통신 경로
Client → Ingress → Service → EndpointSlice → Ready Pod
```

## 선언형 YAML과 적용

현재 Backend 구성은 하나의 YAML에 ConfigMap, Deployment, Service를 선언한다.

```powershell
kubectl apply -f k8s/learning/backend.yaml
```

주요 연결:

```text
backend-config
→ envFrom
→ Backend Container 환경변수

postgres-secret/POSTGRES_PASSWORD
→ secretKeyRef
→ DB_PASSWORD

backend-service selector app=backend
→ Backend Pod label app=backend
→ EndpointSlice에 Ready Pod IP 등록
```

`kubectl apply`는 YAML을 실행하는 명령이 아니다. API Server에 원하는 상태를 제출하고 Controller와 kubelet이 실제 상태를 그 선언에 맞춘다.

## ConfigMap과 Secret 반영 시점

현재 Nginx 실습 Deployment는 ConfigMap과 Secret을 환경변수로 주입한다.

```yaml
envFrom:
  - configMapRef:
      name: nginx-config
  - secretRef:
      name: nginx-secret
```

환경변수는 Container를 시작할 때 만들어진다. Kubernetes에 저장된 ConfigMap·Secret이 나중에 변경돼도 이미 실행 중인 Process 환경변수는 다시 만들어지지 않는다.

실제 검증 결과:

```text
ConfigMap resourceVersion
12165 → 370021

Secret resourceVersion
13163 → 370023

Kubernetes 저장값
→ 새 값으로 변경됨

기존 Pod UID·IP
→ 변경 없음

기존 Container 환경변수
→ 이전 값 유지

Deployment generation
→ 5로 유지
```

ConfigMap·Secret 자체는 Deployment의 Pod Template이 아니다. 따라서 두 Resource만 변경해도 새 ReplicaSet이나 Pod가 자동으로 생기지 않는다.

```powershell
kubectl rollout restart deployment/nginx-deployment
kubectl rollout status deployment/nginx-deployment
```

명시적으로 Rolling Update한 후 새 Pod는 최신 ConfigMap·Secret 값을 환경변수로 받았다.

### Backend 코드 변경과의 공통점

```text
Backend Source 수정
→ 기존 Image 내부 코드는 그대로
→ 새 Image Build와 Pod 교체 필요

ConfigMap·Secret 수정
→ Kubernetes 저장값은 변경
→ 기존 Process 환경변수는 그대로
→ Pod 교체 필요
```

두 경우 모두 핵심은 값을 읽는 시점이다.

```text
Application Code
→ Image Build 시 Image에 포함

환경변수형 ConfigMap·Secret
→ Container 시작 시 주입

Pod Network
→ Pod sandbox 생성 시 구성
```

ConfigMap을 Volume으로 Mount하면 kubelet이 파일을 갱신할 수 있다. 하지만 갱신이 즉시는 아니며 Application이 파일을 다시 읽어야 한다. `subPath` Mount는 자동 갱신되지 않는다. 이번 실습의 `envFrom`은 실행 중 자동 갱신 대상이 아니다.

ConfigMap 변경이 즉시 반영되지 않는 이유는 Pod Network가 아니다. 설정 주입과 Network 구성은 새 Pod 생성 시 함께 일어나지만 서로 다른 작업이다.

## CNI와 Pod Network 생성

새 Pod가 만들어질 때의 핵심 순서:

```text
Scheduler
→ 실행할 Node 선택

kubelet과 Container Runtime
→ Pod sandbox 생성

CNI
→ Network Namespace 구성
→ veth 연결
→ Pod IP 할당
→ Node Route 구성

Container Runtime
→ Container Process 시작
```

실습에서 새 Pod는 처음에 다음 상태였다.

```text
Pending
IP=<pending>
Ready=false
```

CNI 구성이 끝난 후:

```text
Running
IP=10.244.0.x
Ready=false 또는 true
```

Pod IP가 생겼다고 즉시 Traffic을 받는 것은 아니다. Service Traffic 투입 여부는 Readiness가 결정한다.

## Readiness·Liveness·Startup

Probe의 목적:

```text
Startup Probe
→ Application 초기 시작이 끝났는가?

Readiness Probe
→ 이 Pod가 지금 새 요청을 처리할 준비가 됐는가?

Liveness Probe
→ Application이 복구 불가능하게 멈춰 재시작해야 하는가?
```

실패 결과는 다르다.

```text
Readiness 실패
→ Pod는 Running 유지
→ Container 재시작 없음
→ Service Endpoint에서 제외

Liveness 반복 실패
→ 같은 Pod 안에서 Container 재시작
→ Restart Count 증가
```

현재 Backend의 Probe:

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: http

livenessProbe:
  httpGet:
    path: /health/live
    port: http
```

Application 동작:

```text
GET /health/live
→ NestJS HTTP Process가 응답하면 200

GET /health/ready
→ PostgreSQL에 SELECT 1
→ 성공하면 200
→ 실패하면 503
```

예를 들어 NestJS Process는 살아 있지만 DB가 끊기면 Liveness는 성공하고 Readiness는 실패한다. Container를 불필요하게 재시작하지 않고 Traffic만 차단하는 동작이다.

Probe API 자체는 먼저 `port-forward`와 `curl`로 분리 검증할 수 있다.

```powershell
kubectl port-forward deployment/backend-deployment 3000:3000

curl.exe http://localhost:3000/health/live
curl.exe http://localhost:3000/health/ready
```

사람이 `curl`로 검증한 같은 Endpoint를 kubelet이 주기적으로 호출한다.

## Rolling Update와 EndpointSlice 전환

Nginx Deployment는 replicas 3, 기본 Rolling Update 정책을 사용했다.

```text
replicas: 3
maxSurge: 25%
maxUnavailable: 25%
```

정수로 계산하면:

```text
maxSurge = 1
maxUnavailable = 0
```

따라서 기존 Pod 세 개를 유지한 상태에서 새 Pod 한 개를 추가해 순간적으로 네 개가 되고, 새 Pod가 준비된 후 기존 Pod를 하나 제거했다.

관찰한 전환 예시:

```text
기존 Endpoint
10.244.0.16, 10.244.0.17, 10.244.0.18

새 Pod 생성
Pending, IP=<pending>, Ready=false

CNI 구성 완료
10.244.0.19, Ready=true

EndpointSlice
새 IP 10.244.0.19 등록
기존 IP 10.244.0.16은 Ready=false, Terminating=true

반복 후 최종 Endpoint
10.244.0.19, 10.244.0.20, 10.244.0.21
```

종료 중 Endpoint가 잠시 EndpointSlice에 남을 수 있지만 `ready=false`면 정상 Service Traffic 대상으로 사용되지 않는다.

```text
새 Pod Ready
→ Endpoint 등록
→ 기존 Pod Ready=false
→ 기존 Endpoint Traffic 차단
→ 기존 Pod 종료
→ CNI가 기존 Pod Network 정리
```

## 실제 무중단 요청 검증

Nginx Pod에서 Backend Service로 요청을 계속 보내면서 Backend Rolling Update를 실행했다.

```text
Client Pod
→ http://backend-service:3000/health/live
→ Service
→ Ready Backend Pod
```

결과:

```text
연속 요청: 100
성공:      100
실패:      0
```

Backend 전환 중 실제 상태:

```text
기존 Pod 10.244.0.22
→ Ready=true, 요청 처리

새 Pod 10.244.0.23
→ CNI IP 할당
→ 약 11초 동안 Ready=false
→ Service가 요청을 보내지 않음

새 Pod Readiness 성공
→ 10.244.0.23을 Endpoint에 등록
→ 10.244.0.22를 Ready=false, Terminating=true로 전환
```

이 결과는 Pod IP가 있다는 사실만으로 Traffic을 보내지 않고 Readiness를 통과한 Pod만 사용한다는 것을 보여준다.

## Graceful Shutdown

Rolling Update 중 새 요청을 차단하는 것만으로는 충분하지 않다. 기존 Pod가 이미 처리 중인 요청을 끝낼 시간이 필요하다.

Kubernetes 종료 흐름:

```text
Pod 종료 시작
→ Endpoint ready=false
→ Container Process에 SIGTERM
→ terminationGracePeriodSeconds 동안 대기
→ Process가 스스로 종료하지 않으면 SIGKILL
```

NestJS에서 종료 Signal을 처리하도록 다음 설정을 추가했다.

```typescript
const app = await NestFactory.create(AppModule);

app.enableShutdownHooks();
```

Deployment에는 종료 유예시간을 명시했다.

```yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
```

검증에서는 기존 Pod IP에 HTTP 연결을 먼저 열고 요청 Body 전송을 20초 지연했다. 연결이 열린 상태에서 Rolling Update를 시작해 대상 Pod에 SIGTERM을 보냈다.

```text
15:52:16  느린 요청 연결 시작
15:52:18  Rolling Update 시작
15:52:31  새 Pod Ready, 기존 Pod 종료 시작
15:52:37  기존 Pod가 요청 처리와 DB Commit 완료
15:52:42  Client가 응답 수신 완료
이후       기존 Pod 삭제
```

Client 결과:

```http
HTTP/1.1 201 Created
```

진행 중 요청은 SIGTERM 때문에 중간에 끊기지 않았고, DB 저장과 HTTP 응답을 마친 후 기존 Pod가 삭제됐다.

현재 Backend Image와 종료 설정:

```text
Image: backend-infra-testing:graceful-v1
terminationGracePeriodSeconds: 30
```

## 확인 명령

```powershell
# Pod 생성·교체와 IP
kubectl get pods -o wide -w

# Service가 사용하는 실제 Endpoint와 상태
kubectl get endpointslice -w

# Scheduling, Container 시작, Probe 실패, 종료 Event
kubectl get events --sort-by=.lastTimestamp

# Deployment 진행 상태
kubectl rollout status deployment/backend-deployment
kubectl rollout history deployment/backend-deployment

# Probe API 직접 확인
kubectl port-forward deployment/backend-deployment 3000:3000
curl.exe http://localhost:3000/health/live
curl.exe http://localhost:3000/health/ready

# Application Log
kubectl logs deployment/backend-deployment
kubectl logs <종료된-pod> --previous
```

## 현재 결론과 K3s 전환 기준

Minikube에서 다음 항목을 실제로 검증했다.

- Pod·Deployment·ReplicaSet의 생성과 자동 복구
- Service·Label·EndpointSlice의 연결
- ConfigMap·Secret의 환경변수 주입 시점
- CNI의 새 Pod IP 할당과 종료 시 Network 정리
- Readiness와 Liveness의 역할 차이
- Rolling Update 중 Endpoint 전환
- 지속 요청 100회 무중단 처리
- SIGTERM과 30초 종료 유예를 이용한 진행 중 요청 완료
- Ingress HTTP→HTTPS Redirect와 TLS Termination
- PostgreSQL PVC를 이용한 데이터 영속성

K3s에 그대로 가져갈 핵심 Resource는 Deployment, Service, ConfigMap, Secret, PVC, Ingress다. 실제 서버에서는 추가로 Image Registry, Domain DNS, 방화벽 80·443, 공인 인증서 발급, Backup 경로를 결정해야 한다.

현재 단계에서 HPA 고급 튜닝, Multi-node Control Plane, Service Mesh, CNI 내부 구현 심화는 K3s 단일 서버 배포 이후로 미룬다.
