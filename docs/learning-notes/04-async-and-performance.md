# 비동기 처리와 성능

## DB 요청이 비동기인 이유

DB 작업에는 시간이 필요하다.

```text
백엔드가 SQL 전송
→ 네트워크 이동
→ PostgreSQL이 쿼리 실행
→ 결과가 네트워크로 반환
→ 백엔드가 결과 수신
```

시간이 걸릴 수 있는 구간:

```text
백엔드와 DB 사이의 네트워크
쿼리 실행 시간
Lock 대기
Connection Pool 대기
결과 데이터 전송
```

TypeORM 메서드를 호출하면 쿼리는 바로 전송된다. `await`가 쿼리 전송을 미루는 것은 아니다.

## Promise

Promise는 지금 즉시 받을 수 없는 작업의 미래 결과를 나타내는 객체다.

```text
pending   → 작업 진행 중
fulfilled → 작업 성공
rejected  → 작업 실패
```

```ts
findByEmail(email: string): Promise<UserEntity | null>
```

의미:

```text
즉시 받는 값
→ Promise 대기표

나중에 받을 실제 결과
→ UserEntity 또는 null

DB 작업 실패
→ Promise rejected 및 예외
```

데이터 구조는 Promise가 만드는 것이 아니라 Entity와 반환 타입이 정의한다.

## async

`async`는 함수가 Promise를 반환하는 비동기 함수임을 나타낸다.

```ts
async function getNumber() {
  return 10;
}
```

실제로는 다음처럼 Promise가 반환된다.

```ts
Promise.resolve(10);
```

## await

`await`는 Promise가 완료된 뒤 실제 결과를 꺼내고 다음 줄을 실행한다.

```ts
const existingUser =
  await usersRepository.findByEmail(email);
```

```text
SELECT 전송
→ 현재 함수의 다음 줄 실행 대기
→ DB 결과 도착
→ existingUser에 결과 저장
→ 다음 비즈니스 로직 실행
```

`await`가 없으면 실제 사용자 대신 진행 중인 Promise를 받는다.

```ts
const user = repository.findOne(...);
// Promise<UserEntity | null>
```

`await`를 사용하면:

```ts
const user = await repository.findOne(...);
// UserEntity | null
```

## 서버 전체가 멈추지 않는 이유

`await`는 현재 함수의 다음 작업을 기다리게 하지만 NestJS 서버 전체를 중지하지 않는다.

```text
요청 A
→ DB 결과를 await하며 대기

그동안 요청 B
→ Controller와 Service 실행 가능
```

정확히는 `async` 단어 자체가 서버를 멈추지 않게 만드는 것이 아니다. Node.js와 DB 드라이버가 I/O를 비동기로 처리하고, `async/await`는 그 결과를 순차 코드처럼 다루게 해준다.

## 순차 실행과 Promise.all

앞 작업의 결과가 다음 작업에 필요하다면 순차 실행해야 한다.

```text
이메일 중복 조회
→ 중복 여부 판단
→ 사용자 저장
```

```ts
const existingUser =
  await usersRepository.findByEmail(dto.email);

if (existingUser) {
  throw new ConflictException();
}

const user = await usersRepository.save(dto);
```

서로 의존하지 않는 작업은 `Promise.all()`로 동시에 실행할 수 있다.

```ts
const [user, category] = await Promise.all([
  usersRepository.findById(userId),
  categoriesRepository.findById(categoryId),
]);
```

```text
사용자 조회     ─┐
                 ├→ 둘 다 완료된 후 다음 단계
카테고리 조회   ─┘
```

무조건 병렬화하면 안 된다. 두 번째 작업이 첫 번째 결과를 필요로 하면 순차 실행이 필요하다.

## 응답 속도를 결정하는 요소

Service가 처리 순서와 호출 횟수를 결정하지만 실제 속도는 전체 계층의 영향을 받는다.

```text
Service
→ DB·외부 API 호출 횟수
→ 순차 또는 병렬 실행 결정

Repository / SQL
→ 조회 범위와 JOIN 방식

PostgreSQL
→ Index, Lock, 서버 자원

Network
→ 백엔드와 DB 사이 지연
```

문제에 따른 해결 방법:

```text
독립 작업을 순차 실행해서 느림
→ Promise.all

DB 검색 자체가 느림
→ Index와 SQL 최적화

같은 조회가 반복됨
→ Redis Cache

LLM처럼 작업 하나가 매우 오래 걸림
→ Queue + Worker
```

## React Query와 Redis

둘 다 Cache 역할을 할 수 있지만 위치와 범위가 다르다.

```text
React Query
→ 브라우저에 캐시
→ 백엔드 API 호출 감소
→ 로딩·에러·재조회 상태 관리

Redis
→ 서버 측 메모리에 캐시
→ DB와 외부 API 호출 감소
→ 여러 사용자와 서버가 공유 가능
```

전체 흐름:

```text
프론트
→ React Query Cache 확인
├── 있음: 브라우저에서 즉시 사용
└── 없음: 백엔드 요청

백엔드
→ Redis Cache 확인
├── 있음: DB 조회 없이 반환
└── 없음: PostgreSQL 조회 후 Redis 저장
```

## 낙관적 업데이트 주의점

낙관적 업데이트는 서버 응답 전에 UI를 먼저 변경해 빠르게 느끼게 만든다.

```text
화면 먼저 변경
→ 백엔드 요청
→ 성공하면 유지
→ 실패하면 원상복구
```

하지만 낙관적 업데이트가 중복 요청이나 DB 쓰기를 자동으로 줄이지는 않는다.

```text
클릭 10번
→ 방어 로직이 없으면 API 요청 10번
→ DB 작업도 여러 번 발생 가능
```

중복 쓰기 방지는 별도로 설계해야 한다.

```text
프론트
→ 버튼 비활성화, debounce, throttle

백엔드
→ Idempotency Key, 중복 요청 검사

DB
→ Transaction, Lock, Unique Constraint
```

구분:

```text
낙관적 업데이트 → 프론트 UI를 먼저 변경
트랜잭션        → 여러 DB 작업을 전부 성공 또는 전부 취소
낙관적 Lock     → 동시에 같은 데이터를 수정하는 충돌 감지
```
