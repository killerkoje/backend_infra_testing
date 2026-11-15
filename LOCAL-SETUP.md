# macOS 로컬 실행 환경

준비된 환경은 Apple Silicon용 Docker Desktop Linux VM, Node.js 22,
PostgreSQL 16, Minikube, kubectl이다. Docker만 사용하는 실행에는 별도 Ubuntu 설치가 필요 없다.
후속 학습용으로 Lima Ubuntu VM·K3s·cloudflared도 설치했다.
현재 주 학습 환경은 [K3s 서버](./infra/local-server/README.md)이며 Docker/Minikube와 별개다.

## Docker·Minikube 환경

- API: http://localhost:3001/health/ready
- PostgreSQL: localhost:5433 (`.env.example`의 학습용 계정)
- Kubernetes 프로필: `backend-infra-testing` (CPU 2개, 메모리 3072MB)

API는 `backend-infra-testing-api`라는 별도 Docker 컨테이너다.
기존 Compose 파일은 PostgreSQL만 관리한다. DB 마이그레이션 4개를 적용했다.

## 다시 시작하기

```sh
docker desktop start
docker compose up -d --wait
docker start backend-infra-testing-api
/opt/homebrew/bin/minikube start -p backend-infra-testing
```

## 호스트에서 개발하기

현재 기본 Node와 kubectl 경로에 다른 버전이 있으므로 다음 경로를 사용한다.
전역 셸 설정은 변경하지 않았다.

```sh
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH"
docker stop backend-infra-testing-api
PORT=3001 npm run start:dev
```

`.env`는 예제에서 복사했다. 현재 앱은 `.env`를 자동으로 읽지 않으며,
기본 DB 설정이 예제와 같아 위 명령으로 연결된다. 설정을 변경하면 환경변수를
직접 전달해야 한다.

## Kubernetes 실습

```sh
/opt/homebrew/bin/kubectl --context backend-infra-testing get nodes
/opt/homebrew/bin/minikube -p backend-infra-testing image ls
```

`postgres:16-alpine`, `nginx:alpine` 및 백엔드의 `graceful-v1`, `health-v1`
이미지를 클러스터에 적재했다. 학습 YAML의 애플리케이션 배포는 아직 적용하지 않았다.
Ingress YAML은 별도의 `backend-local-tls` Secret이 필요하다.
`memory-stress.yaml`은 의도적으로 메모리 장애를 발생시키는 실습이므로 자동 실행하지 않았다.
Mac 안에 별도 Ubuntu VM `backend-k3s`를 만들어 K3s 배포를 완료했다.
이 K3s 서버는 아래 Docker 중지 명령으로 종료되지 않는다.

```sh
/opt/homebrew/bin/limactl stop backend-k3s
```

터널 종료 방법은 [K3s 서버 문서](./infra/local-server/README.md)를 참고한다.

## 중지하기

```sh
docker stop backend-infra-testing-api
docker compose stop
/opt/homebrew/bin/minikube stop -p backend-infra-testing
```

의존성 설치 시 npm audit 결과는 총 10건(낮음 2, 중간 5, 높음 3)이었다.
운영 의존성만 설치한 Docker 빌드에서는 4건(중간 1, 높음 3)이 보고됐다.
버전 및 잠금 파일은 변경하지 않았다.
