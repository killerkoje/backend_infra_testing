# 백엔드 요청 흐름

## 전체 개념

NestJS 애플리케이션에는 크게 두 가지 흐름이 있다.

### 서버 시작 흐름

```text
AppModule 로드
→ 기능 Module 로드
→ Service와 Repository 객체 생성
→ Controller 객체 생성
→ 생성자를 통해 의존성 주입
→ HTTP Route 등록
→ 요청 대기
```

Module은 요청마다 통과하는 실행 단계가 아니다. 서버가 시작될 때 NestJS가 어떤 객체를 만들고 연결해야 하는지 알려주는 구성 단위다.

### HTTP 요청 처리 흐름

```text
HTTP Request
→ Pipe / Validation
→ Controller
→ Service
→ Repository
→ DB
→ 결과 또는 예외 반환
→ NestJS가 HTTP Response 생성
```

## Module

Module은 도메인 기능에 필요한 구성요소를 묶는다.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
```

역할:

```text
imports
→ 다른 Module이나 외부 기능 연결

controllers
→ HTTP 요청을 받을 Controller 등록

providers
→ 주입해서 사용할 Service와 Repository 등록
```

보통 큰 도메인 단위로 Module을 나눈다.

```text
AppModule
├── UsersModule
├── AuthModule
├── CategoriesModule
└── GenerationsModule
```

## Controller

Controller는 HTTP 요청을 비즈니스 로직 호출로 번역하는 입구다.

담당하는 것:

```text
GET, POST, PATCH, DELETE 구분
URL 경로 연결
Body, Param, Query, Header 추출
필요한 Service 메서드 호출
```

Controller가 HTTP Method를 Service에 문자열로 전달하는 것은 아니다. Controller가 HTTP Method를 보고 호출할 Service 메서드를 직접 선택한다.

```ts
@Post()
create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.usersService.findOne(id);
}
```

처리 연결:

```text
POST /users
→ UsersService.create(dto)

GET /users/1
→ UsersService.findOne(1)
```

## 요청 데이터 추출

HTTP 요청의 데이터는 여러 위치에 존재한다.

```text
@Body()    → 요청 본문
@Param()   → URL 경로 변수
@Query()   → Query String
@Headers() → 요청 Header
```

예시:

```http
POST /users?sendEmail=true
Authorization: Bearer token
Content-Type: application/json

{
  "email": "study@example.com",
  "name": "홍길동"
}
```

```text
Method → POST
Path   → /users
Query  → sendEmail=true
Header → Authorization
Body   → email, name
```

## Service

Service는 Controller가 선택해서 호출한 실제 비즈니스 로직을 수행한다.

```text
Controller
→ 어떤 Service 메서드를 호출할지 결정

Service
→ 호출받은 업무의 규칙과 처리 순서 수행
```

Service는 자신이 GET으로 호출됐는지 POST로 호출됐는지 몰라도 된다.

```ts
async create(dto: CreateUserDto) {
  // 이메일 중복 검사
  // 사용자 생성
  // 저장 요청
}
```

## 생성자와 의존성 주입

`constructor`는 클래스로 객체를 만들 때 자동으로 한 번 실행되는 특별한 함수다.

일반 TypeScript에서는 다음처럼 직접 객체를 연결한다.

```ts
const usersService = new UsersService();
const usersController = new UsersController(usersService);
```

NestJS에서는 Module 등록 정보를 보고 DI Container가 이를 대신 처리한다.

```ts
constructor(private readonly usersService: UsersService) {}
```

이 축약 문법은 대략 다음과 같다.

```ts
private readonly usersService: UsersService;

constructor(usersService: UsersService) {
  this.usersService = usersService;
}
```

서버 시작 시:

```text
UsersService 객체 생성
→ UsersController 객체 생성
→ Controller 생성자에 UsersService 전달
→ this.usersService로 보관
```

생성자는 Service를 호출하는 곳이 아니다. Service 객체를 사용할 수 있도록 연결받는 곳이다. 실제 Service 메서드는 HTTP 요청이 들어왔을 때 호출된다.

## 정상 응답과 오류 응답

Service가 데이터를 반환하면 NestJS가 JSON 응답으로 변환한다.

```text
GET 성공  → 기본 200 OK
POST 성공 → 기본 201 Created
```

Service에서 예외가 발생하면 Controller를 통과해 NestJS의 예외 처리 계층으로 전달된다.

```text
Service에서 NotFoundException 발생
→ NestJS가 예외 포착
→ 404 Not Found 응답
```

대표적인 상태 코드:

```text
400 → 요청 형식 또는 입력값 오류
401 → 인증 필요 또는 인증 실패
403 → 권한 없음
404 → 데이터 없음
409 → 중복 등 현재 데이터와 충돌
500 → 예상하지 못한 서버 오류
```

`500`은 정상적인 업무 실패에 사용하지 않는다. 예상 가능한 실패는 적절한 예외로 변환하고, 예상하지 못한 오류는 서버 로그를 통해 원인을 분석한다.
