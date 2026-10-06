# DB 핵심 개념

## DB 제약조건

DB 제약조건은 어떤 경로로 데이터가 들어오더라도 잘못된 데이터가 최종 저장되지 않게 보호하는 마지막 방어선이다.

```text
DTO 검증
→ API 입력값 보호

Service 검증
→ 비즈니스 규칙 보호

DB 제약조건
→ 실제 저장 데이터의 무결성 보호
```

### NOT NULL

값이 반드시 존재해야 한다.

```sql
email VARCHAR(255) NOT NULL
```

`NOT NULL`은 `NULL`만 막는다. 빈 문자열 `""`은 DTO의 `@IsNotEmpty()` 같은 검증으로 막아야 한다.

### UNIQUE

동일한 값의 중복 저장을 막는다.

```sql
email VARCHAR(255) UNIQUE
```

```text
Service 중복 검사
→ 친절한 오류를 제공하는 1차 검사

DB UNIQUE
→ 동시 요청까지 막는 최종 방어
```

### Primary Key

각 Row를 유일하게 식별한다.

```text
중복 불가능
NULL 불가능
Row 식별 기준
```

### Foreign Key

다른 테이블에 실제로 존재하는 Row만 참조하도록 만든다.

```text
users.id = 1 존재
→ orders.user_id = 1 저장 가능

users.id = 999 없음
→ orders.user_id = 999 저장 거절
```

### CHECK

저장값이 조건을 만족하도록 강제한다.

```sql
CHECK (amount > 0)
CHECK (balance >= 0)
```

## 동시 요청과 Race Condition

Service에서 먼저 이메일을 조회해도 동시 요청은 모두 검사를 통과할 수 있다.

```text
요청 A → SELECT → 사용자 없음
요청 B → SELECT → 사용자 없음

요청 A → INSERT
요청 B → INSERT
```

DB의 UNIQUE 제약조건이 동일 이메일의 중복 저장을 최종 차단한다.

PostgreSQL은 UNIQUE 위반 시 오류 코드 `23505`를 반환한다. 이 오류를 처리하지 않으면 예상 가능한 중복 요청이 `500`으로 응답될 수 있으므로 애플리케이션에서 `409 Conflict`로 변환한다.

```text
Service 사전 조회에서 중복 발견
→ 409 Conflict

동시 요청이 사전 조회를 모두 통과
→ DB UNIQUE가 중복 INSERT 차단
→ PostgreSQL 23505
→ ConflictException으로 변환
→ 409 Conflict
```

현재 프로젝트의 동시 요청 재현 명령:

```powershell
npm run test:concurrency
```

기본적으로 같은 이메일의 요청 10개를 동시에 전송한다.

```text
예상 API 결과
→ 201 Created 1개
→ 409 Conflict 9개
→ 500 응답 0개

예상 DB 결과
→ 해당 이메일 Row 1개
```

이것은 Queue와 다르다.

```text
Queue
→ 요청 전체를 순서대로 처리

Unique Constraint
→ 요청은 동시에 처리
→ 같은 값의 저장 충돌만 DB가 조정
```

먼저 HTTP 요청이 도착한 쪽이 반드시 성공하는 것은 아니다. DB에서 Unique 값을 먼저 확보하고 Commit한 Transaction이 성공한다.

## 트랜잭션

트랜잭션은 여러 컬럼을 묶는 것이 아니다. 여러 DB 작업을 하나의 일관된 업무 단위로 묶는다.

```text
Transaction 시작
→ 여러 조회·생성·수정·삭제 작업
→ 모두 성공: COMMIT
→ 하나라도 실패: ROLLBACK
```

계좌이체 예시:

```text
1. 출금 계좌 조회
2. 입금 계좌 조회
3. 계좌 상태 확인
4. 잔액 확인
5. 출금 계좌 잔액 차감
6. 입금 계좌 잔액 증가
7. 거래 이력 저장
```

모두 성공하면 변경을 확정하고, 하나라도 실패하면 앞에서 수행한 DB 변경도 취소한다.

```text
COMMIT   → 변경 확정
ROLLBACK → 변경 취소
```

조회와 수정 사이에 다른 요청이 데이터를 바꾸지 못하게 해야 한다면 Lock을 함께 사용할 수 있다.

외부 결제사 API의 작업은 우리 DB 트랜잭션으로 Rollback할 수 없다. 외부 작업이 성공한 뒤 내부 DB 작업이 실패하면 보상 작업, 재시도, 멱등성 같은 별도 설계가 필요하다.

### TypeORM Transaction Manager

현재 프로젝트의 생성 완료 업무는 다음 두 DB 변경을 하나의 트랜잭션으로 묶는다.

```text
generation_results에 결과 저장
+
generation_requests를 COMPLETED로 변경
```

```ts
await dataSource.transaction(async (manager) => {
  const resultsRepository =
    manager.getRepository(GenerationResultEntity);

  const requestsRepository =
    manager.getRepository(GenerationRequestEntity);

  await resultsRepository.save(results);
  await requestsRepository.save(request);
});
```

Transaction Callback이 정상 종료되면 TypeORM이 `COMMIT`하고, 예외가 밖으로 던져지면 자동으로 `ROLLBACK`한다.

트랜잭션 내부에서는 반드시 전달받은 `manager`로 얻은 Repository를 사용한다.

```text
manager Repository
→ 같은 Transaction 전용 Connection 사용

기존에 주입받은 일반 Repository
→ 다른 Connection을 사용해 Transaction 밖에서 확정될 위험
```

현재 완료 처리에서는 `pessimistic_write` Lock도 사용한다.

```sql
SELECT ...
FROM generation_requests
WHERE id = $1
FOR UPDATE;
```

동일 요청을 동시에 완료하려는 작업이 같은 Row를 동시에 변경하지 못하도록 한다.

실제 성공 로그:

```text
START TRANSACTION
→ SELECT ... FOR UPDATE
→ generation_results INSERT
→ generation_requests UPDATE COMPLETED
→ COMMIT
```

Rollback 재현 명령:

```powershell
npm run test:transaction-rollback -- <generationRequestId>
```

검증 스크립트는 결과 INSERT 직후 의도적으로 예외를 발생시킨다.

```text
START TRANSACTION
→ 결과 INSERT 성공
→ 의도적 예외
→ ROLLBACK
→ 결과 Row 수 변화 없음
→ 요청 상태 PENDING 유지
```

## Pessimistic Row Lock

Transaction은 한 업무 내부의 원자성을 보장하지만, 여러 Transaction이 같은 Row를 동시에 읽고 수정하는 문제는 Lock으로 제어해야 한다.

현재 생성 완료 처리에서는 다음 TypeORM 설정을 사용한다.

```ts
lock: { mode: 'pessimistic_write' }
```

PostgreSQL SQL:

```sql
SELECT *
FROM generation_requests
WHERE id = $1
FOR UPDATE;
```

Lock은 작업 종류 전체가 아니라 조회된 특정 Row에 걸린다.

```text
request 4 Lock
→ request 4를 수정하는 다른 Transaction은 대기
→ request 5는 다른 Row이므로 별도 처리 가능
```

같은 요청의 동시 완료 흐름:

```text
Transaction A
→ request 4 Row Lock
→ PENDING 확인
→ 결과 INSERT
→ 상태 COMPLETED
→ COMMIT 및 Lock 해제

Transaction B
→ 같은 Row Lock 대기
→ Lock 획득 후 최신 COMPLETED 확인
→ 중복 완료 거절
→ ROLLBACK
```

재현 명령:

```powershell
npm run test:concurrent-completion -- <generationRequestId> 2
```

실제 기대 결과:

```text
201 Created  → 1개
409 Conflict → 1개
결과 Row     → 1개
```

Lock은 Transaction이 `COMMIT` 또는 `ROLLBACK`될 때 PostgreSQL이 자동 해제한다. LLM이나 외부 API 호출처럼 오래 걸리는 작업은 Lock을 잡기 전에 끝내고, Transaction과 Lock의 범위를 짧게 유지한다.

## Index 개념

Index는 DB가 원하는 Row를 빠르게 찾도록 만든 별도의 검색 구조다.

```text
Index 없음
→ 테이블 전체 확인
→ Sequential Scan

Index 있음
→ Index에서 위치 검색
→ Index Scan
```

Index는 주로 다음에 사용되는 컬럼을 기준으로 검토한다.

```text
WHERE
JOIN
ORDER BY
```

화면에 보여줄 컬럼을 정하는 것은 `SELECT`이고, Index는 검색과 정렬을 빠르게 만드는 역할이다.

### 일반 Index

한 컬럼으로 자주 검색하거나 정렬할 때 사용한다.

```sql
SELECT *
FROM users
WHERE email = $1;
```

```sql
CREATE INDEX idx_users_email
ON users (email);
```

### 복합 Index

한 쿼리에서 여러 컬럼을 검색·정렬 조건으로 함께 사용할 때 만든다.

```sql
SELECT *
FROM webtoons
WHERE target_audience = 'FEMALE'
ORDER BY ranking;
```

```sql
CREATE INDEX idx_webtoons_audience_ranking
ON webtoons (target_audience, ranking);
```

복합 Index는 계산용이 아니며, 결과로 보여줄 컬럼을 단순히 묶는 것도 아니다.

### 부분 Index

특정 조건을 만족하는 Row만 Index에 포함한다.

```sql
CREATE INDEX idx_published_webtoons_audience_ranking
ON webtoons (target_audience, ranking)
WHERE status = 'PUBLISHED';
```

```text
공개 웹툰     → Index 포함
비공개 웹툰   → Index 제외
삭제된 웹툰   → Index 제외
```

전체 데이터 중 일부 상태만 반복 조회할 때 유용하다.

```text
처리 대기 주문
결제 실패 건
삭제되지 않은 데이터
읽지 않은 알림
```

### 표현식 Index

함수나 계산을 적용한 결과로 검색할 때 사용할 수 있다.

```sql
SELECT *
FROM users
WHERE LOWER(email) = 'test@example.com';
```

```sql
CREATE INDEX idx_users_lower_email
ON users (LOWER(email));
```

### Covering Index

검색 키뿐 아니라 결과에 필요한 일부 컬럼을 Index에 포함한다.

```sql
CREATE INDEX idx_users_email_cover
ON users (email)
INCLUDE (id, name);
```

컬럼을 많이 포함하면 Index 크기와 갱신 비용이 증가하므로 실제 성능 측정이 필요하다.

## Index의 비용

Index가 많으면 항상 좋은 것은 아니다.

```text
장점
→ 조회 속도 향상 가능

비용
→ 디스크 공간 사용
→ INSERT 시 Index 갱신
→ UPDATE 시 Index 갱신
→ DELETE 시 Index 갱신
```

실제 사용 여부는 실행 계획으로 확인한다.

```sql
EXPLAIN ANALYZE
SELECT *
FROM users
WHERE email = 'test@example.com';
```

```text
Index Scan → Index 사용
Seq Scan   → 테이블 전체 확인
```

### EXPLAIN ANALYZE 읽기

현재 프로젝트의 이메일 조회는 `email UNIQUE`가 만든 B-tree Index를 사용한다.

```text
Index Scan
→ 어떤 Index를 사용했는지 표시

Index Cond
→ Index에서 데이터를 찾은 조건

actual time
→ 실제 실행에 걸린 시간

rows
→ 실제 반환한 Row 수

Buffers: shared hit
→ 디스크가 아니라 PostgreSQL 메모리 Cache에서 읽은 Block 수
```

Index가 없는 `name` 조회에서는 다음 항목을 확인할 수 있다.

```text
Seq Scan
→ 테이블 전체 Row 확인

Filter
→ 각 Row에 적용한 조건

Rows Removed by Filter
→ 조건에 맞지 않아 제외한 Row 수
```

작은 테이블에서는 전체를 순서대로 읽는 비용이 매우 작기 때문에 `Seq Scan`이 Index 조회보다 빠를 수도 있다. Index 사용 여부와 성능은 데이터 양, 조건의 선택도, Cache 상태 등을 포함해 실제 실행 계획으로 판단해야 한다.

## Schema 동기화와 Migration

### synchronize

```ts
synchronize: true
```

애플리케이션 시작 시 TypeORM이 Entity와 실제 DB Schema를 비교해 DB 구조를 자동 변경한다.

```text
Entity 확인
→ DB Schema 비교
→ 테이블·컬럼·제약조건 자동 변경
```

로컬 실습 초기에는 편하지만 운영 DB에서는 의도하지 않은 Schema 변경과 데이터 손실 위험이 있으므로 사용하지 않는다.

### Migration

운영 환경에서는 자동 동기화를 끄고 Schema 변경을 파일로 기록한다.

```ts
synchronize: false
```

```text
Entity 변경
→ Migration 파일 작성 또는 생성
→ SQL과 데이터 영향 검토
→ Migration 실행
→ DB Schema 변경 이력 저장
```

Migration에는 두 방향이 있다.

```text
up   → 변경 적용
down → 변경 되돌리기
```

현재 프로젝트 명령:

```powershell
npm run migration:show
npm run migration:run
npm run migration:revert
```

현재 적용된 Migration:

```text
InitialUsersSchema
→ users 테이블을 초기 Schema 기준으로 등록

AddUserCreatedAt
→ users.created_at 컬럼 추가
```

기존 데이터가 있는 테이블에 필수 컬럼을 추가할 때는 기존 Row에 들어갈 기본값이나 단계적 변경 전략이 필요하다.

```text
1. NULL 허용 컬럼 추가
2. 기존 데이터 채우기
3. 애플리케이션 전환
4. NOT NULL 제약조건 추가
```
