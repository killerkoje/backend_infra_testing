# Database 학습 노트

PostgreSQL Schema, 제약조건, Index, Migration, Transaction과 동시성 제어 내용을 정리한다.

## 문서

1. [DB 핵심 개념](./01-database-core.md)
   - PK, FK, UNIQUE, CHECK
   - 일반·복합·부분·표현식 Index
   - EXPLAIN ANALYZE
   - Migration

2. [Transaction·Lock·Deadlock·Isolation](./02-transaction-lock-isolation.md)
   - Commit과 Rollback
   - TypeORM Transaction Manager
   - Pessimistic·Optimistic Lock
   - Deadlock
   - Isolation Level

3. [PostgreSQL 백업·복원과 시점 복구](./03-postgres-backup-pitr.md)
   - Docker 볼륨·논리 덤프·복원 데이터 대조
   - 기본 백업·WAL 보관·삭제 직전 복구
