# AI 시대 백엔드·인프라 학습 로드맵

## 0. 현재 상태 정리

현재 기준으로 이미 알고 있는 것과 앞으로 채워야 할 것을 분리한다.

### 이미 어느 정도 가능한 것

- 전체적인 서비스 아키텍처를 대략 그릴 수 있음
- 어디에 DB, Redis, Queue, API 서버 등이 들어가는지 감은 있음
- 프론트엔드에서 이벤트 흐름은 이해하고 있음
  - 예: 버튼 클릭 → 상태 변경 → 모달 렌더
- 현재 생각 중인 스택
  - DB: PostgreSQL + pgvector
  - Backend: K3s 또는 Kubernetes
  - Frontend: Vercel
  - 외부 노출: Cloudflare Tunnel 고려
- AI에게 코드를 생성시키는 방식에 대한 거부감은 없음

### 지금 부족하다고 느끼는 것

- 백엔드 내부의 실제 실행 흐름
- ORM(TypeORM 등)이 DB와 어떻게 연결되는지
- DB 스키마 설계
- 트랜잭션 / 인덱스 / 동시성 / 무결성
- Docker / Kubernetes의 실제 운영 흐름
- 회사 규모와 상황에 따른 기술 선택의 트레이드오프
- 장애가 났을 때 어디부터 봐야 하는지
- AI에게 어디까지 맡기고, 사람이 무엇을 알아야 하는지

---

# 1. 최종 목표

목표는 단순히 "Kubernetes를 할 줄 안다" 또는 "TypeORM 코드를 작성할 줄 안다"가 아니다.

최종적으로 아래 흐름을 머릿속에서 추적할 수 있어야 한다.

```text
요구사항
  ↓
데이터 모델
  ↓
API 설계
  ↓
백엔드 실행 흐름
  ↓
DB 읽기/쓰기
  ↓
비동기 처리 / 캐시
  ↓
배포
  ↓
운영
  ↓
장애 분석
```

AI 시대에는 코드를 모두 직접 작성하는 능력보다 다음 능력이 중요하다.

> 어떤 구조가 필요한지 판단하고,
> AI가 만든 구현이 올바른지 검증하고,
> 문제가 생겼을 때 실행 흐름을 추적할 수 있는 능력.

---

# 2. 가장 중요한 공부 원칙

## 원칙 1. 강의 완강을 목표로 하지 않는다

공부 루프는 다음처럼 가져간다.

```text
직접 만든다
→ 막힌다
→ AI에게 설명을 듣는다
→ 그래도 이해가 안 되면 강의/문서를 본다
→ 다시 프로젝트에 적용한다
→ AI에게 리뷰받는다
```

강의는 메인 콘텐츠가 아니라 **막힌 부분을 뚫는 도구**로 사용한다.

---

## 원칙 2. 문법보다 실행 흐름을 공부한다

예를 들어 TypeORM에서 아래 코드를 외우는 게 핵심이 아니다.

```ts
const user = repository.create(data)
await repository.save(user)
```

대신 아래를 이해해야 한다.

```text
HTTP Request
→ Controller
→ Service
→ Repository / ORM
→ SQL 생성
→ PostgreSQL
→ 결과 반환
→ HTTP Response
```

그리고 실패했을 때:

```text
Validation Error
DB Constraint Error
Timeout
Transaction Rollback
Exception Handling
HTTP Error Response
```

이 흐름을 이해해야 한다.

---

## 원칙 3. AI가 작성할 수 있는 것과 내가 알아야 하는 것을 구분한다

### AI에게 적극적으로 맡겨도 되는 것

- CRUD 코드 초안
- TypeORM Entity / Repository 코드
- DTO / Validation 코드
- SQL 초안
- Dockerfile
- docker-compose.yml
- Kubernetes YAML
- GitHub Actions
- Terraform 초안
- 테스트 코드
- 반복적인 API Boilerplate
- 리팩토링 초안

### 내가 반드시 이해해야 하는 것

- 왜 테이블을 이렇게 나눴는가
- PK / FK / Unique가 왜 필요한가
- 어느 구간에 Transaction이 필요한가
- 동시에 요청이 들어왔을 때 무슨 일이 생기는가
- Index가 왜 필요한가
- Redis를 왜 넣거나 빼는가
- Queue를 왜 사용하는가
- API가 실패하면 어디서 복구하는가
- Pod가 죽으면 서비스에 어떤 영향이 있는가
- 이 구조가 우리 회사 규모에 맞는가
- 비용 / 복잡도 / 장애 허용 수준의 트레이드오프

---

# 3. 전체 학습 순서

추천 순서는 아래와 같다.

```text
1. 백엔드 Request Lifecycle
2. SQL / PostgreSQL / DB 설계
3. ORM(TypeORM)
4. Transaction / Index / 동시성
5. Docker
6. Linux / Network
7. 실제 서버 배포
8. K3s / Kubernetes
9. 관측성 / 장애 대응
10. 캐시 / Queue / 확장
11. 회사 상황 기반 트레이드오프
```

Kubernetes를 제일 먼저 공부하지 않는다.

---

# 4. 1단계 — 백엔드 Request Lifecycle

## 목표

프론트에서

```text
버튼 클릭
→ 이벤트 발생
→ 상태 변경
→ 렌더링
```

을 이해하는 것처럼 백엔드에서도 요청 한 번이 어디를 통과하는지 이해한다.

NestJS를 예로 들면:

```text
Client
↓
HTTP Request
↓
Middleware
↓
Guard
↓
Interceptor
↓
Pipe / Validation
↓
Controller
↓
Service
↓
Repository
↓
TypeORM
↓
PostgreSQL
↓
Response
```

처음부터 Middleware / Guard / Interceptor를 전부 외울 필요는 없다.

먼저 아래 흐름만 확실히 익힌다.

```text
Request
→ Controller
→ Service
→ Repository
→ DB
→ Response
```

## 실습

간단한 API 하나를 만든다.

```text
POST /users
GET /users/:id
```

요청이 들어왔을 때 코드를 직접 따라간다.

IDE debugger 또는 console log를 사용한다.

### 반드시 답할 수 있어야 하는 질문

- HTTP 요청은 어느 파일에서 처음 받는가?
- Controller는 무슨 역할인가?
- Service는 왜 따로 있는가?
- Repository는 무슨 역할인가?
- 실제 SQL은 언제 실행되는가?
- DB 오류가 나면 어디까지 exception이 올라오는가?
- 응답 JSON은 어디서 만들어지는가?

---

# 5. 2단계 — PostgreSQL / DB 설계

현재 가장 우선순위가 높은 영역 중 하나.

## 처음 배울 것

```text
Table
Row
Column
Primary Key
Foreign Key
Unique
Not Null
1:N
N:M
JOIN
Index
Transaction
```

정규화 이론을 처음부터 깊게 파지 않는다.

## 실습 프로젝트 예시

광고 카피 생성 서비스를 기준으로 설계한다.

```text
users
categories
prompt_templates
generation_requests
generation_results
```

예를 들어:

```text
users
- id
- email
- created_at

generation_requests
- id
- user_id
- age_group
- gender
- category_id
- status
- created_at

generation_results
- id
- request_id
- main_copy
- sub_copy
- model
- prompt_version
- created_at
```

## 공부해야 할 질문

- User와 Request는 왜 1:N인가?
- Request와 Result를 왜 분리하는가?
- Result를 Request 테이블에 같이 넣으면 어떤 장단점이 있는가?
- 어떤 컬럼에 Unique가 필요한가?
- FK가 없으면 어떤 문제가 생길 수 있는가?
- 삭제 시 Cascade를 써야 하는가?
- 어떤 컬럼에 Index가 필요한가?

---

# 6. 3단계 — ORM(TypeORM)

ORM은 SQL을 몰라도 되는 도구가 아니다.

오히려 아래 관계를 이해해야 한다.

```text
TypeORM 코드
↓
생성된 SQL
↓
PostgreSQL 실행
↓
결과
```

## 공부 방식

TypeORM을 사용할 때 SQL 로그를 켠다.

예:

```ts
await userRepository.findOne({
  where: { email }
})
```

이 코드가 실제로 어떤 SQL이 되는지 확인한다.

## 이 단계에서 알아야 하는 것

- Entity
- Repository
- Relation
- Query Builder
- Migration
- Lazy / Eager Loading
- N+1 문제
- Transaction

TypeORM의 모든 API를 외울 필요는 없다.

---

# 7. 4단계 — Transaction / Index / 동시성

이 부분부터 "백엔드 코드 작성자"에서 "백엔드 시스템 이해자"로 넘어가기 시작한다.

## Transaction

예:

```text
주문 생성
↓
재고 감소
↓
결제 기록 생성
```

중간에 하나 실패하면 어떻게 해야 하는지 생각한다.

```text
BEGIN
주문 생성
재고 감소
결제 기록 생성
COMMIT
```

실패:

```text
ROLLBACK
```

## Index

다음 질문을 중심으로 공부한다.

- Index는 왜 빠른가?
- 모든 컬럼에 Index를 걸면 왜 안 되는가?
- WHERE / JOIN / ORDER BY와 어떤 관계가 있는가?
- Composite Index는 언제 사용하는가?

## 동시성

예:

```text
재고 = 1

사용자 A 구매 요청
사용자 B 구매 요청
```

동시에 실행되면 어떻게 되는가?

여기서 자연스럽게 다음 개념을 접한다.

- Lock
- Isolation Level
- Optimistic Lock
- Pessimistic Lock
- Idempotency

처음부터 깊게 공부하지 않고 문제가 생길 때 확장한다.

---

# 8. 5단계 — Docker

Docker는 Kubernetes보다 먼저 공부한다.

## 이해할 것

```text
Image
Container
Dockerfile
Volume
Network
Environment Variable
Port
```

## 목표

로컬에서 아래 구조가 실행되게 만든다.

```text
docker compose

backend
+
postgres
+
pgvector
```

실행:

```text
Frontend
↓
localhost API
↓
Backend Container
↓
PostgreSQL Container
```

---

# 9. 6단계 — Linux / Network

Kubernetes 전에 반드시 기본적인 네트워크 감각을 만든다.

## Linux

- process
- port
- environment variable
- file permission
- system log
- memory
- CPU
- disk

## Network

- IP
- Port
- DNS
- TCP
- HTTP / HTTPS
- Reverse Proxy
- TLS
- localhost
- private network
- public network

### 반드시 이해해야 하는 질문

```text
localhost:3000은 누구의 localhost인가?
```

Docker 안과 호스트의 localhost는 다르다.

이걸 이해하면 Kubernetes Networking이 훨씬 쉬워진다.

---

# 10. 7단계 — 현재 스택으로 실제 배포

현재 생각하는 구조:

```text
Frontend
- Vercel

Backend
- K3s

External Access
- Cloudflare Tunnel

Database
- PostgreSQL
- pgvector
```

추천 초기 구조:

```text
User
↓
Vercel Frontend
↓
Cloudflare
↓
Cloudflare Tunnel
↓
K3s
↓
ClusterIP Service
↓
Backend Pod
↓
PostgreSQL / pgvector
```

처음에는 PostgreSQL을 Kubernetes 안에 넣지 않아도 된다.

가능하면:

```text
K3s
├── backend
├── worker
└── cloudflared

외부 또는 Managed
└── PostgreSQL + pgvector
```

이렇게 Application과 Database 운영 난이도를 분리한다.

---

# 11. 8단계 — K3s / Kubernetes

## 먼저 K3s를 추천하는 이유

작은 팀 / 작은 서버 / 학습 환경에서는 Kubernetes 전체를 처음부터 구축하는 것보다 K3s가 부담이 적다.

## 처음 공부할 Kubernetes 개념

순서대로:

```text
Pod
↓
Deployment
↓
Service
↓
ConfigMap
↓
Secret
↓
Probe
↓
Resource Request / Limit
↓
Volume
```

그 다음:

```text
Ingress / Gateway
Autoscaling
Persistent Volume
Helm
Observability
```

## 처음 목표

아래 구조를 직접 띄운다.

```text
Cloudflare Tunnel
↓
Service
↓
Deployment
↓
Backend Pod
```

### 이때 이해해야 하는 것

- Pod가 왜 직접 외부에 노출되면 안 되는가?
- Deployment는 왜 필요한가?
- Service는 Pod와 어떻게 연결되는가?
- Pod IP가 바뀌어도 왜 Service는 유지되는가?
- Secret과 ConfigMap의 차이는?
- readinessProbe와 livenessProbe의 차이는?
- Pod가 죽으면 Kubernetes가 어떻게 복구하는가?

---

# 12. 9단계 — 장애 대응 / Observability

여기서부터 운영 감각이 생긴다.

## 일부러 장애를 만든다

### 실습

- Pod 삭제
- 잘못된 환경변수
- DB 접속 정보 오류
- Image Pull 실패
- Memory Limit 너무 작게 설정
- readinessProbe 실패
- Cloudflare Tunnel 종료
- DB 연결 끊기

## Kubernetes에서 확인

```bash
kubectl get pods
kubectl describe pod
kubectl logs
kubectl get events
```

## 서버에서 생각해야 하는 순서

```text
사용자가 접속이 안 된다
↓
DNS?
↓
Cloudflare?
↓
Tunnel?
↓
K8s Service?
↓
Pod?
↓
Application?
↓
DB?
```

이 문제 분해 능력이 매우 중요하다.

---

# 13. 10단계 — Redis / Queue

처음부터 Redis와 Queue를 넣지 않는다.

문제가 생길 때 넣는다.

## Redis

예:

```text
같은 데이터 조회가 너무 많다
↓
DB 부하 증가
↓
Cache 고려
```

생각해야 할 것:

- 어떤 데이터를 캐시할 것인가?
- TTL은 얼마인가?
- DB가 변경되면 Cache는 어떻게 갱신할 것인가?
- 오래된 데이터가 보여도 되는가?

## Queue

예:

```text
LLM 응답이 20초 걸림
```

동기 처리:

```text
User
↓
API
↓
LLM 호출
↓
20초 대기
↓
Response
```

비동기:

```text
User
↓
API
↓
Queue
↓
즉시 request_id 반환

Worker
↓
Queue
↓
LLM
↓
DB 저장
```

이때 배우게 되는 개념:

- Retry
- Dead Letter Queue
- Idempotency
- Worker
- Backpressure

---

# 14. 11단계 — pgvector / RAG

현재 사용하는 PostgreSQL 위에 pgvector를 붙이는 구조는 학습 측면에서도 좋다.

## 이해할 것

```text
Text
↓
Embedding Model
↓
Vector
↓
pgvector 저장
↓
Similarity Search
↓
관련 Context 검색
↓
LLM
```

## 처음에는 알아야 할 것

- Embedding이 무엇인가
- Vector Dimension
- Cosine Similarity
- L2 Distance
- Top K
- Chunking
- Metadata Filter

그 다음 필요할 때:

- HNSW
- IVFFlat
- Hybrid Search
- Reranking

처음부터 vector DB 내부 알고리즘을 깊게 공부할 필요는 없다.

---

# 15. 회사 정보를 "머릿속 RAG"처럼 쌓는 법

아키텍처 판단에는 회사 Context가 매우 중요하다.

다음 정보를 머릿속 또는 문서로 계속 축적한다.

## 조직

- 개발자 수
- 백엔드 개발자 수
- DevOps / SRE 존재 여부
- 각 팀의 기술 숙련도

## 서비스

- DAU
- Peak RPS
- 데이터 크기
- 배포 빈도
- 글로벌 서비스 여부

## 운영

- 장애 허용 시간
- SLA / SLO
- 야간 대응 가능 여부
- 모니터링 수준

## 비용

- Cloud 비용
- Managed Service 비용
- 엔지니어 인건비

## 기술

- 기존 Stack
- Legacy
- 기술 부채
- Migration 난이도

---

# 16. 트레이드오프 판단 연습

아키텍처 실력은 "무엇을 쓸지"보다 "왜 이것을 쓰지 않을지도 설명하는 능력"이다.

예:

```text
개발자 3명
DAU 5,000
Backend 1개
Traffic 낮음
빠른 출시가 중요
```

가능한 판단:

```text
Monolith
PostgreSQL
Managed DB
Docker
K3s 또는 단순 VM 배포
```

반대로:

```text
개발자 100명
Backend 수십 개
팀 여러 개
높은 트래픽
고가용성 필수
```

이라면:

```text
Service 분리
Managed Kubernetes
Kafka
Redis
Observability Platform
Multi-AZ
```

같은 선택이 자연스러워질 수 있다.

중요한 것은 특정 기술이 고급이라서 선택하는 것이 아니다.

---

# 17. AI 시대에 가장 중요한 질문

코드를 볼 때 계속 아래 질문을 한다.

```text
이 함수가 호출되면 다음에 어디로 가지?

실제 DB I/O는 어디서 일어나지?

SQL은 뭐가 생성되지?

동시에 요청 100개가 들어오면?

이 로직 중간에 실패하면?

Transaction boundary는 어디지?

서버가 죽으면 어떤 데이터가 남지?

Retry되면 같은 데이터가 두 번 저장되지 않나?

이 구조에서 가장 먼저 병목이 날 곳은?

이 기술을 빼면 어떤 문제가 생기지?

우리 회사 규모에서 이 복잡도가 필요한가?
```

이 질문에 답할 수 있는 능력이 코드를 직접 빨리 작성하는 능력보다 점점 더 중요해진다.

---

# 18. 추천 프로젝트

현재 하고 있는 광고 카피 생성 서비스를 그대로 학습 프로젝트로 사용한다.

## V1

```text
Frontend
↓
Backend API
↓
LLM API
```

## V2

```text
Frontend
↓
Backend API
↓
PostgreSQL
↓
LLM
```

생성 이력 저장.

## V3

추가:

```text
users
categories
prompt_templates
generation_requests
generation_results
```

DB 설계.

## V4

Docker Compose.

```text
backend
postgres
pgvector
```

## V5

K3s 배포.

```text
Cloudflare Tunnel
↓
K3s Service
↓
Backend
↓
PostgreSQL
```

## V6

비동기 처리.

```text
API
↓
Queue
↓
Worker
↓
LLM
```

## V7

Redis Cache.

## V8

Observability.

```text
Logs
Metrics
Tracing
```

## V9

장애 시뮬레이션.

## V10

부하 테스트 후 병목 분석.

이 프로젝트 하나를 끝까지 밀어붙이면 아래가 모두 연결된다.

```text
Backend
DB
Schema
ORM
Transaction
Docker
Network
Kubernetes
Cloudflare
Redis
Queue
RAG
Monitoring
Architecture
```

---

# 19. 12주 로드맵

## 1~2주

### Backend Lifecycle

- REST API
- Controller
- Service
- Repository
- Validation
- Error Handling
- Debugger

목표:

```text
Request → DB → Response
```

를 완전히 추적.

---

## 3~4주

### PostgreSQL / Schema

- PK
- FK
- Relation
- JOIN
- Index
- Transaction
- Migration

광고 카피 서비스 ERD 직접 설계.

AI에게 리뷰 요청.

---

## 5주

### TypeORM

- Entity
- Repository
- Relation
- Query Builder
- Migration
- SQL Logging

목표:

```text
ORM 코드 → SQL
```

연결.

---

## 6주

### Docker

- Dockerfile
- Compose
- Volume
- Network
- Env

Backend + PostgreSQL 실행.

---

## 7주

### Linux / Network

- Process
- Port
- DNS
- TCP
- HTTP
- TLS
- Reverse Proxy

---

## 8~9주

### K3s

- Pod
- Deployment
- Service
- ConfigMap
- Secret
- Probe
- Resource

Cloudflare Tunnel 연결.

---

## 10주

### 장애 대응

일부러 장애 발생.

로그 기반 해결.

---

## 11주

### Redis / Queue

실제 필요성이 있는 부분에만 적용.

---

## 12주

### 전체 리뷰

다음 질문에 답한다.

```text
이 서비스를 10배 키우면 어디가 먼저 터질까?

DB가 병목이면 어떻게 할까?

LLM 호출이 느려지면?

사용자가 100배 늘면?

Backend Pod 하나가 죽으면?

PostgreSQL이 죽으면?

Cloudflare가 문제가 생기면?

비용을 절반으로 줄여야 한다면?

개발자가 2명뿐이라면 어떤 기술을 제거할까?
```

---

# 20. 공부 시간 배분

추천:

```text
직접 구현       60%
AI 리뷰         20%
강의 / 문서     20%
```

잘못된 패턴:

```text
강의 80%
코딩 20%
```

목표는 지식을 많이 소비하는 것이 아니라 **실제로 문제를 만나고 해결하는 것**이다.

---

# 21. AI 사용 프롬프트 예시

## 코드 리뷰

```text
이 코드의 문법 리뷰가 아니라 실행 흐름 관점에서 리뷰해줘.

1. Request가 어디서 시작하는지
2. DB I/O가 어디서 발생하는지
3. Transaction이 필요한 부분
4. 동시성 문제가 생길 부분
5. 장애가 발생할 수 있는 부분
6. 성능 병목이 될 수 있는 부분

내가 이해할 수 있도록 데이터 흐름 순서대로 설명해줘.
```

## DB 리뷰

```text
내가 설계한 DB Schema를 리뷰해줘.

아래 관점에서 문제를 찾아줘.

- 데이터 무결성
- PK / FK
- 1:N / N:M
- Unique Constraint
- Index
- Transaction
- 향후 확장성
- 중복 데이터

정답 Schema를 바로 만들지 말고
먼저 내가 놓친 부분을 질문으로 알려줘.
```

## Architecture 리뷰

```text
현재 회사 상황은 다음과 같다.

팀 규모:
트래픽:
예산:
장애 허용 수준:
현재 Stack:
운영 인력:
향후 성장 예상:

내가 아래 Architecture를 제안했다.

[Architecture]

기술적으로 가능한지보다,
현재 회사 상황에서 과설계인지 부족한 설계인지 리뷰해줘.

각 기술마다

- 얻는 이점
- 추가되는 운영 복잡도
- 제거했을 때 문제
- 언제 도입하는 게 적절한지

를 설명해줘.
```

---

# 22. 지금 당장 시작할 순서

다음 순서만 따르면 된다.

```text
1. 광고 카피 API 하나 만든다.

2. Controller
   → Service
   → Repository
   → PostgreSQL
   흐름을 직접 추적한다.

3. PostgreSQL Schema를 직접 설계한다.

4. TypeORM SQL Log를 확인한다.

5. Transaction / Index를 필요한 시점에 공부한다.

6. Docker Compose로 Backend + PostgreSQL을 실행한다.

7. K3s 서버에 Backend를 배포한다.

8. Cloudflare Tunnel로 외부에 노출한다.

9. 장애를 일부러 만든다.

10. 로그를 보고 해결한다.

11. 실제 병목이 나타날 때 Redis / Queue를 붙인다.

12. 전체 Architecture를 회사 규모 기준으로 다시 평가한다.
```

---

# 23. 최종적으로 가져가야 할 사고방식

AI 시대 엔지니어의 핵심 역할은 점점 다음과 같이 바뀐다.

과거:

```text
요구사항
↓
사람이 직접 코드 작성
↓
배포
```

앞으로:

```text
요구사항
↓
사람이 문제 정의
↓
사람이 Architecture / Data Model 판단
↓
AI와 설계 검증
↓
AI가 구현 초안
↓
사람이 실행 흐름 검증
↓
AI가 반복 구현
↓
사람이 운영 / 장애 / 트레이드오프 판단
```

따라서 가장 중요한 능력은:

```text
코드 암기
```

가 아니라:

```text
시스템이 실제로 어떻게 실행되는지 이해하는 능력
+
회사 상황에서 적절한 기술을 선택하는 능력
+
AI가 만든 결과를 검증하는 능력
```

이다.

---

# 한 줄 정리

> 백엔드 실행 흐름과 DB를 먼저 깊게 이해하고, Docker → Network → K3s/Kubernetes → 운영 순서로 실제 프로젝트에 적용한다. 코드는 AI에게 적극적으로 맡기되, 데이터 흐름·트랜잭션·동시성·장애·트레이드오프는 반드시 사람이 이해한다.
