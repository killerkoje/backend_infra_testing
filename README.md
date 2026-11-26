# Backend Infrastructure Learning

NestJS와 PostgreSQL로 학습용 API를 만들고, Docker·Kubernetes·Google Cloud에서 배포와 운영을 실습한 저장소다.

## 최근 실습

- **Cloud Run** · 인증 요청, 리비전 간 트래픽 분할, 오토스케일링과 콜드 스타트를 검증했다. [Cloud Run 실습](docs/learning-notes/infra/09-cloud-run-lab.md)
- **CI/CD와 모니터링** · Cloud Build에서 DB 없는 데모를 테스트하고 Artifact Registry에 이미지를 올린다. 새 리비전은 트래픽 0%로 배포하고, 인증 스모크 테스트가 HTTP 200을 받으면 트래픽을 100%로 전환한다. Cloud Monitoring으로 5xx 이메일 알림도 확인했다. [파이프라인 설정](cloudbuild.yaml) · [실습 기록](docs/learning-notes/infra/10-cloud-run-cicd-observability.md)
- **PostgreSQL 복구** · 덤프를 새 볼륨에 복원해 데이터를 대조했다. 격리된 자동 실습에서는 기본 백업과 WAL로 삭제 직전까지 시점 복구를 검증했다. [백업·복구 기록](docs/learning-notes/database/03-postgres-backup-pitr.md)

Terraform 실습은 시작 전이다. [학습 체크포인트](LEARNING-NEXT.md)

## 로컬 API 실행

Node.js 22와 Docker Compose가 필요하다. Compose에서 PostgreSQL 16을 실행하고, NestJS는 호스트에서 실행한다. 호스트 기준 기본 포트는 API 3000, DB 5433이다.

1. 의존성을 설치한다.

   ```sh
   npm ci
   ```

2. PostgreSQL을 시작하고 준비될 때까지 기다린다.

   ```sh
   docker compose up -d --wait postgres
   ```

3. 마이그레이션을 실행한다.

   ```sh
   npm run migration:run
   ```

4. API를 시작한다.

   ```sh
   npm run start:dev
   ```

기동 후 `/health/live`에서 앱 응답을, `/health/ready`에서 DB 연결을 확인할 수 있다.

## 실습 자료

- [전체 학습 노트](docs/learning-notes/README.md)
- [Windows·Minikube 실습](docs/learning-notes/infra/04-minikube-kubernetes-core.md) · [Kubernetes 매니페스트](k8s/learning/)
- [Mac·K3s 실습](docs/learning-notes/infra/08-macos-k3s-lab.md) · [로컬 서버 시작·종료](infra/local-server/README.md)
