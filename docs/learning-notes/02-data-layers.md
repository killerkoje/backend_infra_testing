# DTO·Service·Repository·Entity·TypeORM

## 전체 데이터 흐름

```text
Request JSON
→ DTO 검증
→ Controller
→ Service의 비즈니스 규칙 검증
→ Repository
→ TypeORM
→ PostgreSQL
→ Entity 반환
→ HTTP Response
```

## DTO

DTO는 API를 통해 들어오거나 나가는 데이터의 계약이다.

입력 DTO는 요청 데이터 자체만 보고 판단할 수 있는 형식 규칙을 검사한다.

```text
문자열인가?
이메일 형식인가?
비어 있지 않은가?
최소·최대 길이를 만족하는가?
숫자 범위가 올바른가?
```

```ts
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}
```

DTO는 데이터를 검사한 뒤 버리는 것이 아니다. 검증된 데이터를 정해진 형태로 담아 Service에 전달한다.

```text
DTO 검증
→ 이 데이터를 사용해도 되는지 확인

Service
→ DTO 안의 값을 실제 업무에 사용
```

## DTO 검증과 비즈니스 검증의 차이

현재 요청값만 보고 판단할 수 있으면 DTO가 담당한다.

```text
email이 이메일 형식인가?
name이 비어 있지 않은가?
amount가 숫자이며 0보다 큰가?
계좌번호 형식이 맞는가?
```

기존 데이터나 현재 상태를 조회해야 판단할 수 있으면 Service가 Repository를 사용한다.

```text
이메일이 이미 가입돼 있는가?
계좌가 실제 존재하는가?
잔액이 충분한가?
오늘 거래 한도를 초과했는가?
계좌가 정지 상태인가?
```

## Service

Service에는 회사와 서비스에 맞는 업무 규칙과 처리 순서가 들어간다.

```text
이메일 중복이면 가입 거절
탈퇴한 사용자는 로그인 금지
재고가 없으면 주문 생성 금지
무료 사용자는 하루 10회까지만 생성 가능
결제 성공 후 주문 상태 변경
```

Service는 필요한 데이터를 Repository에 요청하고, 반환된 결과를 업무적으로 해석한다.

```ts
async create(dto: CreateUserDto): Promise<UserEntity> {
  const existingUser =
    await this.usersRepository.findByEmail(dto.email);

  if (existingUser) {
    throw new ConflictException('Email is already in use.');
  }

  return this.usersRepository.save({
    email: dto.email,
    name: dto.name,
  });
}
```

여기서 `findByEmail()`은 조회만 하고, 조회 결과가 이메일 중복을 의미하는지 최종 판단하는 것은 Service다.

## Repository

Repository는 데이터 저장소 접근을 담당하는 코드 계층이다.

```text
ID로 사용자 조회
이메일로 사용자 조회
사용자 저장
사용자 수정
사용자 삭제
```

Repository는 Neon, PostgreSQL, MySQL 같은 DB 자체가 아니다.

```text
Neon      → 관리형 PostgreSQL 서비스
PostgreSQL → DB 엔진
Repository → DB를 조회하고 저장하는 백엔드 코드
```

현재 Repository:

```ts
findByEmail(email: string): Promise<UserEntity | null> {
  return this.repository.findOne({
    where: { email },
  });
}

save(newUser: NewUser): Promise<UserEntity> {
  const entity = this.repository.create(newUser);
  return this.repository.save(entity);
}
```

## Entity

Entity는 TypeScript 객체와 DB 테이블 구조를 연결한다.

```ts
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;
}
```

연결 관계:

```text
UserEntity          users 테이블
────────────        ────────────
id           ↔      id
email        ↔      email
name         ↔      name
```

Entity는 단순 타입만 정의하지 않는다.

```text
테이블 이름
컬럼 타입과 길이
Primary Key
NULL 허용 여부
Unique
기본값
테이블 관계
```

## DTO와 Entity의 관계

```text
DTO
→ API 입력의 형식과 검증 규칙

Entity
→ DB 테이블의 컬럼과 저장 규칙
```

같은 이메일이라도 역할이 다르다.

```text
DTO의 @IsEmail()
→ 요청값이 이메일 형식인지 검사

Entity의 unique: true
→ DB에 같은 이메일이 중복 저장되는 것을 방지
```

실무에서는 용도별 DTO를 만들 수 있다.

```text
CreateUserDto   → 생성 요청
UpdateUserDto   → 수정 요청
UserResponseDto → 프론트 응답
UserEntity      → DB 저장 구조
```

Entity를 그대로 응답하지 않고 Response DTO를 사용하면 비밀번호나 내부 관리 필드 노출을 방지할 수 있다.

## TypeORM

TypeORM은 Entity 정보를 바탕으로 SQL을 만들고 DB 결과를 Entity 객체로 변환하는 ORM이다.

```text
Repository 메서드 호출
→ Entity 구조 확인
→ SQL 생성
→ PostgreSQL에서 실행
→ 결과를 Entity로 변환
```

대표 메서드:

```text
find()    → SELECT
findOne() → 조건부 SELECT
insert()  → INSERT
update()  → UPDATE
delete()  → DELETE
save()    → Entity 상태에 따라 INSERT 또는 UPDATE
```

`create()`와 `save()`는 다르다.

```text
repository.create()
→ 메모리에 Entity 객체만 생성
→ DB I/O 없음

repository.save()
→ SQL을 생성해 실제 DB에 저장
```

ORM을 사용해도 생성된 SQL을 검증해야 한다.

```text
Entity 관계 설정 오류
조건 누락
N+1 쿼리
불필요한 데이터 조회
Index 미사용
의도하지 않은 UPDATE
```

현재 프로젝트는 개발 학습용으로 SQL 로그를 출력한다.

```ts
logging: ['query', 'error']
```
