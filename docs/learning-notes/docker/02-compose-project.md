# Docker Compose와 현재 프로젝트

## Docker Compose

Compose는 여러 Container와 Network, Volume, 환경변수 등의 실행 구성을 YAML 파일 하나로 관리한다.

```text
docker-compose.yml
├── services
├── networks
└── volumes
```

현재 프로젝트에는 PostgreSQL Service 하나가 있다.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: backend_learning
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Service와 기본 Network

Compose는 별도 Network 설정이 없어도 Project 전용 기본 Network를 만든다. 같은 Compose 안의 Service는 Service Name으로 통신할 수 있다.

```text
backend Container
→ postgres:5432
→ postgres Service
```

현재는 Backend가 Compose Service가 아니므로 Host에 공개된 Port를 사용한다.

```text
NestJS on Host
→ localhost:5433
→ Port Mapping
→ PostgreSQL Container:5432
```

## Health Check

현재 PostgreSQL Service는 `pg_isready`로 DB가 Connection을 받을 준비가 됐는지 확인한다.

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d backend_learning"]
  interval: 5s
  timeout: 5s
  retries: 10
```

차이:

```text
Container Running
→ PostgreSQL Process가 실행 중일 수 있음

Container Healthy
→ 설정된 Health Check 기준으로 요청을 받을 준비가 됨
```

Process가 실행됐다는 사실과 Application이 준비됐다는 사실은 다르다.

## Named Volume

```yaml
volumes:
  postgres_data:
```

`postgres_data`는 PostgreSQL 데이터 Directory에 연결된다. Container가 재생성돼도 Volume을 삭제하지 않는 한 데이터가 유지된다.

Compose를 종료하는 것과 Volume까지 삭제하는 것은 영향이 다르므로 DB 실습 데이터가 필요할 때는 삭제 범위를 먼저 확인해야 한다.

## 현재 연결 설정

`.env.example`:

```dotenv
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=backend_learning
```

`AppModule`은 이 값을 이용해 TypeORM Connection을 만든다.

```text
NestJS
→ TypeORM
→ localhost:5433
→ Docker Port Mapping
→ PostgreSQL:5432
```

향후 Backend도 Container로 옮기면 `DB_HOST`와 `DB_PORT`가 다음처럼 바뀐다.

```dotenv
DB_HOST=postgres
DB_PORT=5432
```

Host에 공개된 Port가 아니라 Compose 내부 DNS와 Container Port를 사용하기 때문이다.
