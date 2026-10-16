# Docker 핵심 개념

## Image와 Container

Image는 애플리케이션 실행에 필요한 파일과 설정을 담은 읽기 전용 Template이다. Container는 Image를 바탕으로 실제 실행된 Process다.

```text
Dockerfile
→ Image Build
→ Image
→ Container 실행
```

같은 Image에서 여러 Container를 실행할 수 있다.

```text
backend-image
├── backend-container-1
└── backend-container-2
```

Container는 작은 VM 자체라기보다 격리된 Process에 가깝다. Host Kernel을 공유하면서 Process, Network, File System 등의 실행 공간을 분리한다.

## Port Mapping

Container 내부 Port는 기본적으로 Host 외부에서 바로 접근할 수 없다. Port Mapping으로 Host Port와 Container Port를 연결한다.

```yaml
ports:
  - "5433:5432"
```

의미:

```text
Host localhost:5433
→ Container의 5432
→ PostgreSQL
```

표기 순서는 `Host Port : Container Port`다.

`EXPOSE`는 Image가 사용할 Port를 설명하는 Metadata에 가깝다. Host에 실제 공개하려면 `docker run -p` 또는 Compose의 `ports`가 필요하다.

## localhost의 의미

`localhost`는 항상 현재 실행 주체 자기 자신을 가리킨다.

```text
Host의 localhost
→ Host 자신

Backend Container의 localhost
→ Backend Container 자신

PostgreSQL Container의 localhost
→ PostgreSQL Container 자신
```

따라서 Backend와 PostgreSQL이 서로 다른 Container라면 Backend에서 `localhost:5432`로 PostgreSQL에 연결할 수 없다. 같은 Compose Network에서는 Service Name을 Host Name으로 사용한다.

```text
DB_HOST=postgres
DB_PORT=5432
```

반면 현재 프로젝트처럼 NestJS가 Host에서 실행되고 PostgreSQL만 Container라면 다음 Mapping을 사용한다.

```text
DB_HOST=localhost
DB_PORT=5433
```

## Volume

Container의 Writable Layer에만 저장된 데이터는 Container를 삭제할 때 함께 사라질 수 있다. DB 데이터처럼 유지해야 하는 데이터는 Volume에 저장한다.

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

```text
Container 교체
→ PostgreSQL Process와 Container File System은 교체 가능
→ Named Volume의 DB 데이터는 유지
```

Volume이 Backup을 자동으로 대신하는 것은 아니다. 잘못된 쿼리나 Volume 손상에 대비하려면 별도 Backup과 복구 검증이 필요하다.

## Environment Variable

환경변수는 실행 환경에 따라 달라지는 값을 코드 밖에서 주입한다.

```text
DB Host
DB Port
DB Username
DB Password
Application Port
```

환경변수를 사용하면 같은 Image를 개발·검증·운영 환경에서 서로 다른 설정으로 실행할 수 있다.

Secret 값을 Image나 Git Repository에 직접 포함하지 않는다. 현재 `docker-compose.yml`의 PostgreSQL Password는 로컬 학습용 값이다.
