# Mac 안의 Linux 서버와 외부 접속

구조: 외부 HTTPS → Cloudflare 임시 터널 → Mac의 `127.0.0.1:8082`
→ Lima Ubuntu VM의 80 → K3s Traefik Ingress → 백엔드 → PostgreSQL.

이 서버는 Docker Desktop과 별개인 Lima VM이다. Docker Desktop을 종료해도
이 VM과 터널은 종료되지 않는다. Mac이 꺼지거나 잠들면 서비스 접근이 중단될 수 있다.

## 서버 접속 및 상태 확인

```sh
/opt/homebrew/bin/limactl shell backend-k3s
uname -s
whoami
sudo k3s kubectl get nodes
sudo k3s kubectl -n backend-learning get pods,svc,ingress,pvc
```

`limactl shell`은 SSH 연결을 관리한다. Mac으로 돌아오려면 `exit`.

## VM 다시 시작 / 중지

```sh
/opt/homebrew/bin/limactl start backend-k3s
/opt/homebrew/bin/limactl stop backend-k3s
```

K3s는 VM 안의 systemd 서비스로 시작된다. DB 데이터는 VM 디스크의 PVC에 남는다.
VM 삭제나 PVC 삭제는 중지와 다르며 데이터를 잃을 수 있다.

## 외부 공개 시작 / 중지

Mac 터미널에서 실행한다.

```sh
/opt/homebrew/bin/cloudflared tunnel --url http://127.0.0.1:8082
```

출력된 `https://….trycloudflare.com/health/ready`로 접속한다.
이 터미널에서 `Ctrl+C`를 누르면 외부 공개가 종료된다.
새로 시작하면 URL이 달라질 수 있다. 계정과 도메인이 필요 없는 개발용 터널이며,
고정 도메인을 사용하는 운영 배포와는 차이가 있다.

에이전트가 시작한 터널처럼 실행 터미널이 따로 없다면 먼저 프로세스를 찾는다.

```sh
pgrep -fl 'cloudflared tunnel --url http://127.0.0.1:8082'
```

출력된 명령이 이 프로젝트의 터널인지 확인하고 `kill -TERM <PID>`로 종료한다.
PID는 실행마다 달라진다. 임시 공개 URL도 현재 터널 출력에서 확인한다.

API에는 현재 로그인 인증이 없다. URL을 가진 사람은 조회·생성 API를 호출할 수 있다.
이번 배포의 PostgreSQL은 별도의 새 학습 DB이며 기존 Docker DB와 데이터를 공유하지 않는다.

## 처음부터 배포하는 절차

저장소 루트에서 실행한다. `docker build`와 `image save`에는 Docker Desktop이 필요하다.

```sh
limactl start --yes --name=backend-k3s infra/local-server/lima.yaml
docker build -t backend-infra-testing:version-v2 .
docker pull postgres:16-alpine
docker image save --platform linux/arm64 -o /private/tmp/backend-k3s-image.tar backend-infra-testing:version-v2 postgres:16-alpine
limactl cp /private/tmp/backend-k3s-image.tar backend-k3s:/tmp/backend-k3s-image.tar
limactl shell backend-k3s sudo k3s ctr images import /tmp/backend-k3s-image.tar
limactl cp infra/local-server/prepare-db.sh infra/local-server/app.yaml infra/local-server/hpa.yaml backend-k3s:/tmp/
limactl shell backend-k3s sh /tmp/prepare-db.sh
limactl shell backend-k3s sudo k3s kubectl apply -f /tmp/app.yaml
limactl shell backend-k3s sudo k3s kubectl -n backend-learning rollout status deployment/postgres --timeout=180s
limactl shell backend-k3s sudo k3s kubectl -n backend-learning rollout status deployment/backend --timeout=180s
limactl shell backend-k3s sudo k3s kubectl -n backend-learning exec deployment/backend -- ./node_modules/.bin/typeorm -d dist/database/data-source.js migration:run
limactl shell backend-k3s sudo k3s kubectl apply -f /tmp/hpa.yaml
```

Secret은 `prepare-db.sh`가 무작위 비밀번호로 생성하며 저장소에 기록하지 않는다.
백엔드 이미지는 ARM64 로컬 파일로 전달한다. 레지스트리 사용은 후속 학습이다.

참고: [Lima 사용법](https://lima-vm.io/docs/usage/),
[K3s 설치](https://docs.k3s.io/quick-start),
[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## 현재 학습 완료 상태

`version-v2` 배포와 이전 이미지 롤백을 검증하고 최종 v2로 복원했다.
HPA는 CPU 50%, 최소 1개·최대 3개이며 실제 1→3→1을 확인했다.
[전체 실습 기록](../../docs/learning-notes/infra/08-macos-k3s-lab.md)을 참고한다.
기존 HPA가 관리하는 Deployment에 `app.yaml`을 재적용하면 `replicas: 1`이 잠시 반영될 수 있다.
지속적인 자동 배포에서는 HPA가 관리할 replicas 필드를 선언 파일에서 분리하는 정책을 정해야 한다.
