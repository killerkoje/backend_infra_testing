# Queue·Worker·ACK

## Queue와 Worker

Queue에는 Worker가 아니라 처리할 Job이 쌓인다.

```text
Queue
├── Job 1
├── Job 2
└── Job 3

Workers
├── Worker A
└── Worker B
```

Worker는 Queue에서 Job을 가져와 실제 작업을 수행한다.

```text
API
→ 생성 요청을 PENDING으로 저장
→ Queue에 Job 등록
→ requestId 즉시 반환

Worker
→ Job 수신
→ LLM 호출
→ 결과 저장
→ 상태 COMPLETED
→ ACK
```

Worker가 하나면 작업은 순차 처리에 가깝고, Worker가 여러 개면 여러 Job을 병렬 처리할 수 있다.

```text
Worker A → Job 1
Worker B → Job 2
```

입장 순서와 완료 순서는 다를 수 있다.

```text
Job 1 → 10초 소요
Job 2 → 2초 소요

입장 순서: 1, 2
완료 순서: 2, 1
```

같은 대화처럼 앞 작업의 결과가 다음 작업 Context에 필요한 경우에는 `conversation_id` 같은 기준으로 처리 순서를 보장해야 한다.

## Queue를 사용하는 이유

```text
오래 걸리는 작업을 API 응답과 분리
작업이 몰릴 때 Buffer 역할
Worker 수로 동시 처리량 조절
실패한 작업 재시도
일시적인 장애에도 Job 보존
```

LLM 요청이 1,000개 들어와도 API가 모든 요청의 LLM 응답을 직접 기다리지 않는다.

```text
API
→ Job 1,000개를 Queue에 등록

Worker 10개
→ 처리 가능한 양만 가져감

나머지 Job
→ Queue에서 대기
```

## ACK

ACK는 `Acknowledgement`의 약자로 Worker가 Queue에 보내는 작업 완료 확인 신호다.

정상 흐름:

```text
Queue가 Worker A에 Job 전달
→ Worker A가 업무 처리
→ DB COMMIT
→ Worker A가 ACK 전송
→ Queue가 Job 완료 처리
```

실패 흐름:

```text
Worker A가 DB COMMIT
→ ACK 전송 직전 프로세스 종료
→ Queue는 완료 사실을 모름
→ 같은 Job을 Worker B에 재전달
```

Worker가 종료되는 실제 원인:

```text
Pod 재시작
서버 배포
OOM Kill
프로세스 오류
네트워크 단절
```

## Visibility Timeout과 중복 실행

Queue는 Job을 Worker에게 전달한 뒤 일정 시간 다른 Worker에게 보이지 않게 할 수 있다.

```text
Visibility Timeout = 30초
LLM 처리 시간 = 50초
```

```text
00초 → Worker A가 Job 수신
30초 → Timeout 만료, Queue에 Job 재등장
31초 → Worker B가 같은 Job 수신
50초 → Worker A 처리 완료
81초 → Worker B 처리 완료
```

Worker A가 죽지 않아도 같은 Job이 동시에 실행될 수 있다.

Queue가 동일 Job을 중복 전달할 수 있는 대표 원인:

```text
DB Commit 후 ACK 전송 전 Worker 종료
ACK 네트워크 유실
Visibility Timeout보다 긴 작업
명시적 Retry
Webhook 재전송
여러 서버에서 같은 Scheduler 실행
```

## At-least-once와 멱등성

많은 Queue 설계는 작업 유실을 막기 위해 최소 한 번 이상 전달하는 방식을 사용한다.

```text
작업 유실 방지
→ 필요하면 재전달
→ 중복 실행 가능성 존재
```

따라서 Worker는 같은 Job이 여러 번 도착해도 최종 결과가 중복되지 않도록 설계해야 한다.

```text
Job 수신
→ request 상태 확인
├── PENDING: 처리 진행
└── COMPLETED: 중복 처리 생략
→ ACK
```

백엔드 방어 수단:

```text
Idempotency Key
Job ID UNIQUE
DB UNIQUE Constraint
Transaction
Row Lock
상태 전이 검사
제한적인 Retry
```

## 프론트 중복과의 차이

Queue ACK 재전달 문제는 프론트가 요청을 한 번만 보내도 발생할 수 있는 백엔드 분산 시스템 문제다.

```text
프론트 원인
→ 버튼 연타
→ API 자동 재시도

백엔드 원인
→ ACK 유실
→ Worker 재시작
→ Queue 재전달
→ Webhook Retry
```

프론트가 중복 요청을 방지해도 백엔드는 자체적으로 멱등성을 보장해야 한다.
