# AI 백엔드·인프라 학습 노트

이 폴더는 `ai_backend_infra_learning_roadmap.md`를 따라 실습하면서 이해한 내용을 주제별로 정리한다.

## 주제별 폴더

### [Backend](./backend/README.md)

- [백엔드 요청 흐름](./backend/01-request-flow.md)
- [DTO·Service·Repository·Entity·TypeORM](./backend/02-data-layers.md)
- [비동기와 성능](./backend/03-async-and-performance.md)
- [Queue·Worker·ACK](./backend/04-queue-worker-ack.md)
- [HTTP와 WebSocket](./backend/05-http-and-websocket.md)

### [Database](./database/README.md)

- [DB 핵심 개념](./database/01-database-core.md)
- [Transaction·Lock·Deadlock·Isolation](./database/02-transaction-lock-isolation.md)

### [Docker](./docker/README.md)

- [Docker 핵심 개념](./docker/01-docker-core.md)
- [Docker Compose와 현재 프로젝트](./docker/02-compose-project.md)

### [Infra](./infra/README.md)

- [Linux 실행 환경](./infra/01-linux-runtime.md)
- [Network·HTTP·WebSocket](./infra/02-network-http-websocket.md)
- [Reverse Proxy·Nginx·TLS](./infra/03-reverse-proxy-tls.md)

## 현재 학습 진도

```text
Backend Request Lifecycle       완료
PostgreSQL / DB 설계            완료
TypeORM                         완료
Transaction / Lock / 동시성     완료
Docker                          완료
Linux / Network                 Reverse Proxy까지 학습
실제 서버 배포                  다음 단계
K3s / Kubernetes               예정
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
