# AI 백엔드·인프라 학습 노트

이 폴더는 `ai_backend_infra_learning_roadmap.md`를 따라 실습하면서 이해한 내용을 주제별로 정리한다.

## 주제별 폴더

### [Backend](./backend/README.md)

- [백엔드 요청 흐름](./backend/01-request-flow.md)
- [DTO·Service·Repository·Entity·TypeORM](./backend/02-data-layers.md)
- [비동기와 성능](./backend/03-async-and-performance.md)
- [Queue·Worker·ACK](./backend/04-queue-worker-ack.md)

### [Database](./database/README.md)

- [DB 핵심 개념](./database/01-database-core.md)
- [Transaction·Lock·Deadlock·Isolation](./database/02-transaction-lock-isolation.md)

### [Infra](./infra/README.md)

아직 인프라 단계 전이므로 폴더와 향후 학습 목차만 준비한다.

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
