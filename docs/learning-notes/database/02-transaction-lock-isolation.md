# Transaction·Lock·Deadlock·Isolation

## Transaction

Transaction은 하나의 업무를 구성하는 여러 DB 변경을 하나의 원자적인 작업으로 묶는다.

```text
모든 작업 성공
→ COMMIT

하나라도 실패
→ ROLLBACK
```

컬럼 개수가 아니라 서로 연관된 DB 작업의 일관성이 기준이다.

광고 생성 완료 업무:

```text
generation_results에 결과 저장
generation_requests 상태를 COMPLETED로 변경
사용량 차감
처리 이력 저장
```

이 작업들이 함께 있어야 완료 상태가 성립한다면 같은 Transaction에 포함한다.

Transaction에 포함하지 않을 작업:

```text
LLM API 호출
결제사 API 호출
이메일 발송
Slack 알림
오래 걸리는 파일 처리
```

외부 시스템은 PostgreSQL Transaction으로 Rollback할 수 없다. 재시도, Queue, Outbox, 보상 작업 같은 별도 설계가 필요하다.

## TypeORM Transaction Manager

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

Transaction Callback이 정상 종료되면 TypeORM이 Commit하고, 예외가 밖으로 전달되면 Rollback한다.

Transaction 안에서는 반드시 전달받은 `manager`로 Repository를 얻어야 한다.

```text
manager Repository
→ 같은 Transaction 전용 DB Connection

기존 주입 Repository
→ 다른 Connection에서 독립 Commit될 가능성
```

일부 작업이 Transaction 밖에서 먼저 Commit되면 다음과 같은 중간 상태가 남을 수 있다.

```text
요청 상태는 COMPLETED
생성 결과는 Rollback되어 없음
```

## Transaction 실제 검증

성공:

```text
START TRANSACTION
→ 결과 INSERT
→ 요청 상태 UPDATE
→ COMMIT
```

실패:

```text
START TRANSACTION
→ 결과 INSERT 성공
→ 의도적인 예외
→ ROLLBACK
→ 결과 Row가 남지 않음
→ 요청 상태 PENDING 유지
```

```powershell
npm run test:transaction-rollback -- <generationRequestId>
```

## Lock이 필요한 이유

Transaction은 하나의 업무 내부 원자성을 보장하지만 여러 Transaction이 같은 Row를 동시에 읽고 수정하는 문제는 별도로 제어해야 한다.

재고가 하나 남았을 때:

```text
Transaction A → 재고 1 조회
Transaction B → 재고 1 조회
```

두 Transaction이 모두 구매 가능하다고 판단할 수 있다. Lock은 같은 Row의 처리를 순서화한다.

## Pessimistic Lock

충돌 가능성이 높다고 보고 Row를 먼저 잠근다.

```ts
lock: { mode: 'pessimistic_write' }
```

```sql
SELECT *
FROM generation_requests
WHERE id = $1
FOR UPDATE;
```

같은 Row 동시 처리:

```text
요청 A
→ Row Lock
→ PENDING 확인
→ 결과 저장
→ COMPLETED
→ COMMIT 및 Lock 해제

요청 B
→ 같은 Row Lock에서 대기
→ A의 Commit 후 최신 COMPLETED 확인
→ 409 Conflict
→ ROLLBACK
```

다른 Row는 동시에 처리할 수 있다.

```text
request 4 Lock
request 5 Lock
→ 서로 간섭 없이 병렬 처리
```

적합한 사례:

```text
재고 차감
계좌 잔액 변경
좌석 예약
쿠폰 사용
한 번만 수행해야 하는 완료 처리
```

Transaction과 Lock은 짧게 유지하며 외부 API 호출은 Lock 밖에서 끝낸다.

동시 완료 재현:

```powershell
npm run test:concurrent-completion -- <generationRequestId> 2
```

```text
201 Created  → 1개
409 Conflict → 1개
결과 Row     → 1개
```

## Optimistic Lock

미리 잠그지 않고 수정 시점에 `version`을 비교해 충돌을 감지한다.

```text
초기 version = 1

A와 B가 version 1 조회
A가 수정 → version 2
B가 version 1로 수정 시도
→ 조건 불일치
→ 충돌로 거절
```

```sql
UPDATE prompt_templates
SET content = $1,
    version = version + 1
WHERE id = $2
  AND version = $3;
```

수정된 Row가 0개면 다른 Transaction이 먼저 변경했는지 확인하고 `409 Conflict`를 반환할 수 있다.

적합한 사례:

```text
게시글 수정
사용자 프로필 수정
Prompt Template 편집
상품 설명 수정
관리자 설정 변경
```

구분:

```text
Pessimistic Lock
→ 충돌 전에 잠금
→ 다른 요청은 대기

Optimistic Lock
→ 잠그지 않음
→ 저장 시 version 충돌 감지
→ 충돌한 요청은 재조회·재시도
```

## Deadlock

Deadlock은 여러 Transaction이 서로가 보유한 Lock을 기다리며 진행하지 못하는 상태다.

```text
Transaction A
→ Row 1 Lock 보유
→ Row 2 Lock 대기

Transaction B
→ Row 2 Lock 보유
→ Row 1 Lock 대기
```

PostgreSQL은 Deadlock을 감지하면 Transaction 하나를 강제로 Rollback한다.

예방:

```text
모든 로직의 Lock 획득 순서 통일
ID 오름차순으로 Row Lock
Transaction 짧게 유지
필요한 Row만 Lock
외부 API는 Transaction 밖에서 호출
Deadlock 오류에 제한적 Retry
DB 로그와 Lock 대기 모니터링
```

Deadlock은 코드 리뷰로 예측 가능한 경우도 있지만 여러 기능과 실행 타이밍이 얽히면 동시성 테스트나 운영 로그에서 발견될 수 있다.

## Isolation Level

격리 수준은 동시에 실행되는 Transaction이 다른 Transaction의 변경을 어떤 시점 기준으로 볼지 정한다.

### Read Committed

PostgreSQL 기본값이다. 각 SQL이 실행되는 시점의 최신 Commit 데이터를 본다.

```text
B 첫 조회 → 잔액 100만 원
A가 50만 원 출금 후 COMMIT
B 두 번째 조회 → 잔액 50만 원
```

일반 API와 CRUD는 보통 `READ COMMITTED`에서 시작하고, 중요한 수정은 Row Lock과 DB 제약조건을 조합한다.

### Repeatable Read

Transaction이 보는 DB Snapshot을 유지한다.

```text
B 첫 조회 → 잔액 100만 원
A가 50만 원 출금 후 COMMIT
B 두 번째 조회 → 여전히 100만 원
B Transaction 종료 후 새 조회 → 50만 원
```

여러 조회가 동일한 기준 시점을 사용해야 하는 정산·통계·재무 계산 등에 고려할 수 있다.

### Serializable

동시에 실행된 Transaction도 하나씩 순서대로 실행한 것과 같은 결과만 허용한다.

안전한 순서를 만들 수 없으면 Transaction 하나를 실패시켜 재시도하게 한다.

```text
강한 일관성
→ 충돌과 실패 증가 가능
→ 재시도 로직 필요
→ 동시 처리량 감소 가능
```

### Lock과 격리 수준의 차이

```text
Lock
→ 특정 Row를 누가 언제 변경할 수 있는지 제어

Isolation Level
→ Transaction이 다른 Transaction의 변경을 언제부터 볼지 제어
```

실무에서는 격리 수준을 무조건 높이지 않는다.

```text
기본 READ COMMITTED
+
필요한 Row Lock
+
UNIQUE, FK, CHECK 제약조건
```

으로 시작하고 동일 Snapshot이나 더 강한 순차 실행 보장이 필요한 업무에만 높은 격리 수준을 적용한다.
