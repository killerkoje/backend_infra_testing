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
