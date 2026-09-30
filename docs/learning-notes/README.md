# 백엔드·DB 학습 노트

이 폴더는 `ai_backend_infra_learning_roadmap.md`를 따라 실습하면서 이해한 내용을 주제별로 정리한다.

## 문서 목록

1. [백엔드 요청 흐름](./01-backend-request-flow.md)
   - Module, Controller, Service
   - 의존성 주입과 생성자
   - HTTP 요청부터 응답까지의 실행 순서

2. [데이터 계층](./02-data-layers.md)
   - DTO, Service, Repository, Entity, TypeORM
   - 각 계층의 역할과 데이터 전달 과정

3. [DB 핵심 개념](./03-database-core.md)
   - 제약조건, 트랜잭션, 동시성
   - 일반·복합·부분·표현식 Index

4. [비동기와 성능](./04-async-and-performance.md)
   - Promise, async, await
   - Promise.all, Redis, React Query

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
