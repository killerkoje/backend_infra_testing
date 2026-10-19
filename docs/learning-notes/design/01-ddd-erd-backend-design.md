# DDD와 ERD: 백엔드 설계 개념

## 1. 한눈에 보는 핵심

- **DDD(Domain-Driven Design, 도메인 주도 설계)**: 비즈니스의 개념·규칙·책임을 중심으로 소프트웨어를 설계하는 접근법
- **ERD(Entity Relationship Diagram, 개체 관계도)**: 데이터베이스에 저장할 데이터의 구조와 테이블 간 관계를 표현하는 다이어그램
- **State Machine(상태 머신)**: 객체나 작업이 어떤 상태를 가지며, 어떤 조건에서 상태를 전환할 수 있는지 모델링하는 방식
- **Event-Driven Architecture(이벤트 기반 아키텍처)**: 이벤트 발생을 기준으로 컴포넌트가 반응하고 통신하는 아키텍처 방식

```text
DDD
→ 비즈니스가 어떻게 동작해야 하는가?

ERD
→ 필요한 데이터를 어떻게 저장하고 연결할 것인가?
```

DDD와 ERD는 둘 중 하나를 고르는 관계가 아니라 상호 보완 관계다.

## 2. DDD란?

DDD는 회사 정책만 다루는 것이 아니라, 서비스 전반의 도메인 지식과 비즈니스 규칙을 코드의 모델과 책임으로 표현하는 방식이다.

### 광고 이미지 대량 생성 서비스 예시

- 원본 PSD가 있어야 생성 작업을 시작할 수 있다.
- 이미 진행 중인 작업은 다시 시작할 수 없다.
- 실패한 작업만 재시도할 수 있다.
- 광고주별로 허용하는 생성 개수가 다를 수 있다.

이 규칙을 단순히 여러 API Handler에 흩뿌리는 대신, `GenerationJob` 같은 도메인 객체 또는 도메인 서비스가 책임지도록 설계한다.

### DDD 주요 개념

| 개념 | 의미 | 예시 |
|---|---|---|
| Domain | 문제를 해결하려는 비즈니스 영역 | 광고 생성 |
| Entity | 식별자와 연속성이 중요한 도메인 객체 | 생성 작업 |
| Value Object | 고유 식별자보다 값이 중요한 객체 | 이미지 크기, 타겟 조건 |
| Aggregate | 함께 일관성을 지켜야 하는 도메인 객체의 경계 | 생성 작업 및 설정 |
| Domain Service | 하나의 Entity에 자연스럽게 속하지 않는 도메인 규칙 | 생성 가능 여부 정책 계산 |
| Repository | 도메인 객체의 저장·조회에 대한 추상화 | 생성 작업 저장소 |
| Bounded Context | 용어와 모델이 일관된 의미를 갖는 경계 | 광고 소재 관리, 작업 실행 관리 |

> DDD의 Entity는 도메인 개념이고, TypeORM의 `@Entity()`는 DB Mapping 개념이다. 작은 프로젝트에서는 한 클래스로 합칠 수도 있지만 개념적으로 동일하지는 않다.

## 3. ERD란?

ERD는 데이터를 어디에 어떤 형태로 저장하며 서로 어떻게 연결할지 표현한다. 특정 이벤트마다 상태를 만든다는 뜻은 아니다. 상태(`status`)는 테이블이 저장하는 수많은 Column 중 하나일 수 있다.

예시 데이터 구조:

```text
users
  id (PK)
  name
  email

ad_templates
  id (PK)
  psd_url
  width
  height

generation_jobs
  id (PK)
  user_id (FK → users.id)
  template_id (FK → ad_templates.id)
  status
  created_at
```

관계 예시:

- 사용자 1명 → 생성 작업 여러 개 (`1:N`)
- 템플릿 1개 → 생성 작업 여러 개 (`1:N`)

ERD에서는 Table, Column, PK/FK, 관계(`1:1`, `1:N`, `N:M`), 제약조건 및 중복 최소화 등을 고민한다. ERD 자체가 비즈니스 규칙의 실행 방식이나 Repository Method 내용을 결정하지는 않는다.

## 4. 혼동하기 쉬운 개념: 상태와 이벤트

광고 생성 작업의 상태가 다음과 같다고 가정하자.

```text
pending → processing → completed
                └──→ failed → retrying → processing
```

- **State Machine**: 허용되는 상태 전이와 전이 조건을 설계한다. 예: `completed` 작업은 다시 `processing`으로 바뀔 수 없다.
- **DDD**: 위 조건이 중요한 비즈니스 규칙이라면 어떤 도메인 객체가 이를 보장할지 결정한다.
- **ERD**: 현재 상태를 `generation_jobs.status` Column에 저장할 수 있다.
- **Event-Driven Architecture**: `JobCompleted` 이벤트가 발생하면 알림 서비스나 후처리 서비스가 반응할 수 있다.

따라서 이벤트마다 상태를 갖고 상태 기반으로 설계한다는 설명은 ERD가 아니라 상태 머신 또는 이벤트 기반 설계에 더 가깝다.

## 5. NestJS + TypeORM에서는 어디에 적용할까?

```text
HTTP Request
    ↓
Controller
    ↓
Application Service
→ Use Case 조율: 생성 요청 처리 등
    ↓
Domain Model / Domain Service
→ 비즈니스 규칙: DDD의 핵심
    ↓
Repository Interface
→ Domain이 필요로 하는 저장·조회 계약
    ↓
TypeORM Repository 구현체
→ DB 접근 구현
    ↓
PostgreSQL
→ ERD로 설계한 데이터 구조
```

이것은 가능한 설계 예시이고, 모든 NestJS 프로젝트가 반드시 이 계층을 분리해야 하는 것은 아니다. 단순한 서비스에서는 계층을 합칠 수도 있다.

| 구분 | 주로 담당하는 관심사 | DDD / ERD와의 관계 |
|---|---|---|
| Controller | HTTP 요청·응답, 입력 검증 | DDD/ERD 자체는 아님 |
| Application Service | 여러 작업의 순서와 Use Case 조율 | DDD의 Application 계층 |
| Domain | 핵심 규칙, 객체 책임과 불변 조건 | DDD 중심 |
| Repository Interface | Domain 관점의 조회·저장 계약 | DDD의 영향 |
| TypeORM Repository / ORM Entity | 데이터 Mapping과 영속성 처리 | ERD와 밀접 |
| PostgreSQL Schema | Table, Column, 관계와 제약조건 | ERD 중심 |

핵심은 `DDD = Service 코드`, `ERD = Repository 코드`라고 일대일 대응시키지 않는 것이다. DDD는 Domain과 Repository 추상화까지 영향을 주고, ERD는 Repository 구현이 접근할 DB 구조를 설명한다.

## 6. 코드 예시: 비즈니스 규칙과 DB 저장의 구분

```ts
// 도메인 규칙: 진행 중이거나 완료된 작업은 시작할 수 없음
class GenerationJob {
  constructor(
    public readonly id: string,
    private status: 'pending' | 'processing' | 'completed' | 'failed',
  ) {}

  start() {
    if (this.status !== 'pending') {
      throw new Error('대기 상태의 작업만 시작할 수 있습니다.');
    }

    this.status = 'processing';
  }
}
```

위 `start()`는 DDD 관점에서 모델링한 도메인 규칙이다. ERD에서는 이 객체의 상태를 저장할 `status` Column 등을 정의한다.

실제 여러 Worker의 동시 실행을 막으려면 DB의 원자적 조건부 Update, Transaction, Lock, 중복 요청 제어 등도 별도로 고려해야 한다.

## 7. 실제 개발 순서 예시

1. **요구사항 파악**: 광고 생성 시 어떤 입력과 정책이 필요한가?
2. **도메인 규칙 정리**: 생성, 재시도, 취소 등에 어떤 조건이 있는가?
3. **도메인 경계·책임 설계**: 광고 소재, 생성 작업, 작업 실행을 어떻게 구분할까?
4. **데이터 모델링(ERD)**: 어떤 테이블과 관계, 제약조건이 필요한가?
5. **Repository 및 Application 계층 구현**: DB 접근과 Use Case 실행을 연결한다.
6. **API 구현 및 테스트**: 정상 흐름뿐 아니라 상태 전이, 동시성, 실패·재시도를 검증한다.

이 순서는 고정된 절차가 아니라 실제 구현 과정에서 반복적으로 수정할 수 있다.

## 8. 최종 정리

- **DDD**: 비즈니스 개념, 규칙, 책임을 모델링하는 설계 접근법
- **ERD**: 데이터와 관계를 모델링하는 DB 설계 다이어그램
- **State Machine**: 상태와 허용 전이를 모델링하는 행동 설계 도구
- **EDA**: 이벤트로 구성 요소를 연결하는 아키텍처 방식

기억할 한 줄:

> DDD는 왜, 어떤 규칙으로 동작해야 하는지를 중심으로 설계하고, ERD는 어떤 데이터를 어떻게 저장하고 연결할지를 표현한다.
