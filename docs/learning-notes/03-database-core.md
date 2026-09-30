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
