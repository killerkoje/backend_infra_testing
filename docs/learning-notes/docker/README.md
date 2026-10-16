# Docker 학습 노트

Docker의 실행 단위와 네트워크 경계를 이해하고, 현재 프로젝트의 PostgreSQL Compose 구성을 정리한다.

## 문서

1. [Docker 핵심 개념](./01-docker-core.md)
   - Image와 Container
   - Port Mapping과 localhost
   - Volume과 Environment Variable

2. [Docker Compose와 현재 프로젝트](./02-compose-project.md)
   - PostgreSQL Service
   - Health Check와 Named Volume
   - Host에서 실행되는 NestJS와의 연결

## 현재 구현 상태

```text
Windows / WSL Host
├── NestJS :3001
└── Docker Compose
    └── PostgreSQL :5432
         ▲
         └── Host에는 :5433으로 공개
```

현재는 PostgreSQL만 Container로 실행한다. Backend Image와 Backend Service는 아직 Compose에 추가하지 않았다.
