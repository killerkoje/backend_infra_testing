# Backend 학습 노트

NestJS 요청 흐름과 애플리케이션 계층, 비동기 처리, Queue 기반 작업 처리 내용을 정리한다.

## 문서

1. [백엔드 요청 흐름](./01-request-flow.md)
   - Module, Controller, Service
   - 생성자와 의존성 주입
   - HTTP 요청과 응답

2. [데이터 계층](./02-data-layers.md)
   - DTO, Service, Repository, Entity, TypeORM
   - 1:N 관계와 Foreign Key

3. [비동기와 성능](./03-async-and-performance.md)
   - Promise, async, await
   - Promise.all, Redis, React Query

4. [Queue·Worker·ACK](./04-queue-worker-ack.md)
   - 비동기 Job 처리
   - ACK와 재전달
   - 중복 실행과 멱등성
