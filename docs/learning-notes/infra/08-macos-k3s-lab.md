# Mac·K3s 실습 전체 기록

2026-11-15 학습 기록. Windows·Minikube 학습 이후 Mac의 Ubuntu VM에서 직접 재확인한 내용이다.
현재 구성의 재현 명령은 [서버 실행 문서](../../../infra/local-server/README.md)에 있다.
아래 Kubernetes 명령은 Ubuntu 셸에서 실행한다.

## 1. Linux 서버 접속과 프로세스

Mac에서 서버 접속:

```sh
/opt/homebrew/bin/limactl shell backend-k3s
```

`uname -s`는 운영체제, `whoami`는 사용자, `pwd`는 현재 폴더,
`ls`는 파일 목록, `ps`는 실행 중인 프로세스를 보여준다.
`exit`는 접속 셸을 종료하며 백엔드 프로세스 자체를 종료하지 않는다.
컨테이너에서는 `/app/dist/main.js`가 코드 파일이고 `node dist/main.js`가 실행 중인 프로세스다.
Linux VM은 Mac 안에서 별도 서버 역할을 한다. Docker Desktop을 꺼도 Lima VM은 별도로 중지해야 한다.

## 2. Cluster·Control Plane·Node·Namespace

[전체 숲 Mermaid 그림](./06-kubernetes-big-picture.md)을 먼저 본다.

- Cluster는 전체 Kubernetes 환경이고 Node는 물리 서버 또는 VM이다.
- Control Plane은 관리 구성요소다. 그 안의 Scheduler가 Pod를 배치할 Node를 고른다.
- Node의 kubelet이 containerd를 통해 컨테이너를 실행하고 상태를 보고한다.
- 현재 `lima-backend-k3s` 한 대가 관리와 앱 실행을 함께 맡는다.
- `ROLES`는 규칙이 아닌 역할이다. `Ready`는 Node 준비 상태이며 앱 정상 여부와는 별개다.
- Namespace는 논리적인 리소스 구분 공간이다. Node 안의 폴더나 별도 네트워크가 아니다.

```sh
sudo k3s kubectl get nodes
sudo k3s kubectl -n backend-learning get pods
sudo k3s kubectl get pods -A
```

`-n`은 namespace, `-A`는 모든 namespace, `-o wide`는 상세 열 출력,
`-w`는 변경 사항 관찰이다. `Ctrl+C`로 관찰만 끝내도 앱은 계속 실행된다.
한 줄 명령에서는 `\`를 넣지 않는다. 여러 줄로 나눌 때 `\` 바로 뒤에 줄바꿈을 넣는다.

## 3. Deployment·ReplicaSet·Pod 자동 복구

```text
Deployment: Pod 설정·배포 버전 관리
  → ReplicaSet: 원하는 개수 유지
    → Pod: 컨테이너 실행 단위
```

`replicas: 1`에서 백엔드 Pod를 삭제하자 다른 이름의 새 Pod가 생겼다.
죽은 Pod를 되살리는 것이 아니라 새로운 Pod를 만든다.
원하는 개수를 0으로 바꾸면 다시 만들지 않는다.

```sh
sudo k3s kubectl -n backend-learning get deployments
sudo k3s kubectl -n backend-learning delete pod -l app=backend
sudo k3s kubectl -n backend-learning get pods -w
```

Deployment의 `READY 1/1`은 준비된 Pod 수 / 원하는 Pod 수다.
Pod 목록의 `READY 1/1`은 Pod 안의 준비된 컨테이너 수다.

## 4. Service·Label·Selector·EndpointSlice

```text
Service Selector: app=backend
  → 같은 라벨의 Pod 선택
  → EndpointSlice에 Pod IP와 준비 상태 등록
  → 준비된 대상으로 트래픽 전달
```

`app`은 우리가 정한 라벨 키다. 앱 이름 전용 기능이 아니다.
Service가 요청마다 라벨을 검색하는 프로세스라는 뜻도 아니다.
Service의 ClusterIP는 클러스터 내부 접속 주소이며, Pod IP와 다르다.

실습 당시 backend-service IP는 `10.43.203.226`이었다.
Pod 삭제 후 대상 IP는 `10.42.0.13 → 10.42.0.14`로 자동 갱신됐고 Service IP는 유지됐다.
Service를 삭제·재생성하면 Service IP도 달라질 수 있다.

```sh
sudo k3s kubectl -n backend-learning get services
sudo k3s kubectl -n backend-learning get pods -o wide --show-labels
sudo k3s kubectl -n backend-learning describe service backend-service
sudo k3s kubectl -n backend-learning get endpointslices -l kubernetes.io/service-name=backend-service -o wide
```

클라이언트는 `backend-service:3000`을 계속 사용하고, Endpoint는 실제 Pod 교체에 따라 바뀐다.

## 5. Startup·Readiness·Liveness와 DB 장애

| 검사 | 현재 설정 | 실패 누적 시 동작 |
|---|---|---|
| Startup | `/health/live`, 5초 주기, 연속 30회 | 컨테이너 재시작 |
| Readiness | `/health/ready`, 5초 주기, 연속 3회 | 일반 Service 트래픽 대상 제외 |
| Liveness | `/health/live`, 10초 주기, 연속 3회 | 컨테이너 재시작 |

현재 timeout은 1초다. Startup 성공 전에는 Readiness·Liveness가 시작되지 않는다.
이 앱은 Readiness에서 DB에 `SELECT 1`을 실행하고 Liveness는 HTTP 응답을 확인한다.
검사 실패가 반드시 특정 장애 원인을 뜻하지는 않으며 실제 검사 내용을 봐야 한다.

```sh
sudo k3s kubectl -n backend-learning scale deployment postgres --replicas=0
sudo k3s kubectl -n backend-learning get pods -w
# 관찰 종료 후 반드시 DB 복구
sudo k3s kubectl -n backend-learning scale deployment postgres --replicas=1
```

DB 중단 시 백엔드는 `0/1 Running`, 재시작 0이었다.
DB 복구 후 재시작 없이 `1/1 Running`으로 돌아왔다.
Running은 실행 상태, Ready는 트래픽을 받을 준비 상태다.

## 6. PVC·PV·DB 데이터

```text
PostgreSQL Pod → PVC postgres-data → PV → Ubuntu VM 디스크
```

`postgres-data`는 `Bound`, 용량 `1Gi`, 접근 모드 `RWO`, StorageClass `local-path`다.
PVC는 저장 공간 요청 리소스이고 PV는 연결된 저장 공간 리소스다.
RWO는 한 Node에서 읽기·쓰기 연결이 가능하다는 뜻이며 반드시 Pod 하나라는 뜻은 아니다.
DB Pod가 없어져도 PVC와 실제 데이터가 남으면 새 Pod에 다시 연결할 수 있다.
SQL로 데이터 삭제, PVC 삭제, VM 디스크 손실은 별개다. PVC는 백업이 아니다.
이번에는 PVC 연결과 재마운트를 확인했고 별도 백업 복원 실습은 아직 하지 않았다.

## 7. Rolling Update와 롤백

`rollout restart deployment/backend` 후 두 터미널로 상태를 관찰했다.

```text
새 Pod: Pending → ContainerCreating → Running 0/1 → Running 1/1
기존 Pod: 새 Pod Ready 이후 Terminating → Completed → 삭제
```

새 Pod이므로 `RESTARTS`는 0이다. 같은 Pod의 컨테이너 재시작 횟수와 구분한다.
`rollout history`, `rollout undo`, `rollout status`로 이력·롤백·완료를 확인했다.
롤백은 이전 Pod를 되살리는 것이 아니라 이전 설정을 최신 배포로 다시 적용한다.
ReplicaSet이 재사용되면서 revision 2가 4로 갱신돼 이력이 1·3·4로 보이는 현상도 확인했다.
실제 코드 변경을 포함한 v2 이미지 배포 결과는 [별도 문서](./07-image-deploy-rollback.md)에 있다.

## 8. Requests·Limits·HPA

| 항목 | CPU | 메모리 |
|---|---|---|
| 백엔드 request | 100m | 128Mi |
| 백엔드 limit | 500m | 256Mi |
| 최초 관찰 사용량 | 2m | 39Mi |

CPU 1000m은 코어 1개다. Requests는 스케줄링 기준이며 Limits는 사용 상한이다.
CPU 상한에서는 throttling, 메모리 상한 초과에서는 OOM 종료가 발생할 수 있다.
HPA CPU 사용률은 request 대비 비율이다. `2m / 100m = 2%`이며 50% 목표는 평균 50m에 해당한다.

```text
Metrics Server → HPA → Deployment replicas 변경 → ReplicaSet → Pod 추가·축소
```

MINPODS·MAXPODS는 범위(1~3), REPLICAS는 현재 Pod 수다.
HPA는 Node나 물리 CPU를 추가하지 않는다. Node 용량이 부족하면 Pod가 Pending에 머물 수 있다.

```sh
sudo k3s kubectl -n backend-learning top pods
sudo k3s kubectl -n backend-learning autoscale deployment backend --cpu=50% --min=1 --max=3
sudo k3s kubectl -n backend-learning get hpa -w
```

HPA가 이미 있으면 생성 명령을 반복하지 않는다. `--cpu-percent`는 설치된 버전에서 deprecated 안내가 나왔다.
재현용 선언 파일은 `infra/local-server/hpa.yaml`이다.

별도 터미널에서 학습용 CPU 부하를 60초 발생시켰다. 실행 중 앱 응답이 느려질 수 있다.

```sh
sudo k3s kubectl -n backend-learning exec deployment/backend -- node -e 'const end=Date.now()+60000; while(Date.now()<end){}'
```

Pod가 1→3개로 늘고 Endpoint IP도 3개가 됐다. 부하 종료 후 안정화 시간을 거쳐 1개로 줄었다.

| HPA Condition Reason | 해석 |
|---|---|
| ScaleDownStabilized | 최근 높은 권장 개수를 유지하며 급격한 축소 방지 |
| ValidMetricFound | CPU 지표로 정상 계산 |
| TooManyReplicas | 계산된 권장 개수가 최대값을 넘어 상한 적용 |
| NotScaledToZero | 0개로 축소하지 않았다는 상태. 3→1 축소 지연의 원인은 아님 |

기본 축소 안정화 구간은 약 5분이며 HPA AGE가 아니라 최근 권장 기록을 기준으로 판단한다.

## 9. Ingress·Traefik·터널·권한의 차이

Ingress는 Host·Path를 어느 Service로 보낼지 적은 규칙이다.
Traefik(트래픽)은 실제 요청을 받는 리버스 프록시이자 Ingress Controller다.
현재는 Host 제한 없이 `/` Prefix 경로를 `backend-service:3000`으로 보낸다.
`describe ingress`의 `Host *`는 도메인 제한이 없다는 표시이며 IAM 권한 설정이 아니다.
Kubernetes API 리소스 권한 관리는 RBAC, 앱 사용자의 로그인 권한은 앱 인증에서 다룬다.

```text
인터넷 → Cloudflare HTTPS → Mac의 cloudflared → Lima 포트 전달
→ Ubuntu의 Traefik → Ingress 규칙에 지정된 Service의 대상 Pod
```

Ingress Address `192.168.5.15`는 VM 내부 IP이며 공인 IP가 아니다.
Cloudflare Tunnel은 Mac이 밖으로 연결을 맺어 외부 요청을 받는 경로를 만든다.
공유기 포트포워딩이나 별도 클라우드 호스팅은 이번에 설정하지 않았다.
Tailscale 기본 연결은 허용된 기기의 사설 네트워크이고 Funnel은 공개 접속 기능이다.
Tailscale은 개념만 비교했으며 설치하지 않았다.

## 10. ConfigMap·Secret·로그

ConfigMap은 일반 설정, Secret은 비밀번호 같은 민감 설정을 전달하는 리소스다.
현재 K3s 앱의 일반 설정은 Deployment env에 직접 적고 DB 비밀번호는 Secret에서 가져온다.
ConfigMap을 사용하는 이전 Minikube 구성과 구분한다.

```sh
sudo k3s kubectl -n backend-learning get secrets
sudo k3s kubectl -n backend-learning logs deployment/backend --tail=30
sudo k3s kubectl -n backend-learning describe pod -l app=backend
sudo k3s kubectl -n backend-learning describe hpa backend
```

- `get`: 현재 상태 조회.
- `describe`: 세부 설정·Conditions·Kubernetes Events 확인.
- `logs`: 앱이 출력한 로그 확인. 반복되는 `SELECT 1`은 Readiness DB 검사다.
- `Found 3 pods, using pod/...`: 여러 Pod 중 하나의 로그만 선택했다는 뜻이다.
- Deployment의 `ScalingReplicaSet` 이벤트는 배포·롤백에서도 발생하며 HPA 확장 증거로 단정할 수 없다.

## 다음 학습

Image Registry에 이미지 업로드·다운로드 → CI/CD → DB 백업·복원 → 메트릭·로그·알림 심화.
별도 외부 Linux 서버, 고정 도메인·방화벽·원본 공인 TLS 구성은 추가 실습 대상이다.
