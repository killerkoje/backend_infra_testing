# PostgreSQL 백업·복원과 시점 복구

2026-11-25 실습. 논리 백업을 별도 DB와 새 컨테이너에 복원한 뒤, 기본 백업과 WAL을 사용한 삭제 직전 복구까지 검증했다.

## 1. 실행 볼륨과 백업 파일

[Docker Compose](../../../docker-compose.yml)의 `postgres` 서비스는 PostgreSQL 16을 실행한다. `backend_learning` DB의 데이터 디렉터리인 `/var/lib/postgresql/data`에는 Docker 볼륨 `backend_infra_testing_postgres_data`가 연결돼 있다. 같은 볼륨을 연결하면 컨테이너 교체 후에도 DB가 데이터 파일을 읽을 수 있다.

백업 실습에서는 `pg_dump`가 만든 시점 고정 파일을 Windows의 `Documents/backend-infra-backups`로 복사했다. 데이터 볼륨에는 최신 데이터가 계속 쓰이고, 덤프에는 백업 시점 데이터가 들어 있다. 호스트 디스크 손실까지 대비하는 운영 환경에서는 DB 호스트 밖의 객체 저장소나 관리형 백업 저장소에 보관한다.

## 2. 덤프 생성과 확인

저장소 루트의 PowerShell에서 Compose PostgreSQL을 띄우고 상태를 확인한다.

```powershell
docker compose up -d postgres
docker compose ps
```

`healthy` 상태에서 Custom 형식의 덤프를 생성한다. `-T`는 Docker Compose에 가상 터미널 할당을 끄도록 지시한다. `-Fc`는 PostgreSQL의 Custom 아카이브 형식이다.

```powershell
$dumpArgs = @(
    'compose', 'exec', '-T', 'postgres',
    'pg_dump', '-U', 'postgres',
    '-d', 'backend_learning',
    '-Fc', '-f', '/tmp/learning.dump'
)
docker @dumpArgs
```

```powershell
docker compose exec -T postgres pg_restore --list /tmp/learning.dump
```

덤프 목차에서 테이블과 데이터, 시퀀스와 다음 값, 인덱스, 기본 키·외래 키를 확인했다. Windows PowerShell과 컨테이너 셸 사이에서 문자열 인용이나 줄 끝 처리가 꼬이면 `sh: backend_learning: not found` 또는 파일을 열 수 없다는 오류가 나올 수 있다. 위처럼 DB 이름과 출력 경로를 `pg_dump` 인자로 직접 줘 해결했다.

## 3. 빈 DB에 복원하고 데이터 비교

다음 명령은 복원용 DB가 아직 없을 때 한 번 실행한다.

```powershell
docker compose exec -T postgres createdb -U postgres backend_learning_restore
```

```powershell
$restoreArgs = @(
    'compose', 'exec', '-T', 'postgres',
    'pg_restore', '-U', 'postgres',
    '-d', 'backend_learning_restore',
    '--single-transaction', '/tmp/learning.dump'
)
docker @restoreArgs
```

`--single-transaction`은 복원 작업을 한 트랜잭션으로 실행한다. 원본과 복원본에서 같은 쿼리를 각각 실행한다.

```sql
SELECT 'users' AS table_name, count(*) FROM public.users
UNION ALL SELECT 'generation_requests', count(*) FROM public.generation_requests
UNION ALL SELECT 'generation_results', count(*) FROM public.generation_results
UNION ALL SELECT 'migrations', count(*) FROM public.migrations
ORDER BY 1;
```

두 DB에서 `users` 4행, `generation_requests` 3행, `generation_results` 3행, `migrations` 4행이었다. 각 테이블의 행을 ID 순서로 정렬해 JSON으로 만든 뒤 체크섬을 비교했고 네 테이블 모두 일치했다.

### 컨테이너 밖의 백업만으로 복구

`docker compose cp`로 덤프를 PC에 복사하고 원본과 복사본의 SHA-256을 대조했다. 원본 Compose 볼륨과 다른 임시 볼륨을 사용하는 새 PostgreSQL 컨테이너에 **PC에 저장한 파일만** 복사해 복원했다. 네 테이블의 행 수와 데이터 체크섬은 다시 일치했다. 이 검증에 사용한 임시 컨테이너와 임시 볼륨은 정리했다.

별도의 임시 DB에서는 백업 전에 1번 행, 백업 후에 2번 행을 넣고 덤프를 복원했다. 원본에는 둘 다 있었고 복원본에는 1번만 있었다. 백업 주기가 길수록 마지막으로 복구할 수 있는 시점과 장애 발생 사이에 유실될 수 있는 변경이 늘어난다. **RPO**는 허용 가능한 데이터 손실 시간의 목표이고, **RTO**는 허용 가능한 서비스 복구 시간의 목표다.

## 4. 기본 백업과 WAL로 삭제 직전 복구

WAL은 PostgreSQL이 데이터 파일에 변경을 반영하기 전에 복구에 필요한 변경 기록을 남기는 로그다. `archive_mode`가 꺼져 있어도 WAL은 기록된다. `archive_mode=on`과 `archive_command`를 구성하면 완성된 WAL 세그먼트를 별도 위치에 보관할 수 있다. 논리 덤프는 WAL 재생의 출발점으로 쓰지 않는다. 이 실습에서는 물리적 기본 백업을 `pg_basebackup`으로 만든다. [PostgreSQL 16 시점 복구 문서](https://www.postgresql.org/docs/16/continuous-archiving.html)

1. 네트워크를 차단한 임시 PostgreSQL을 시작한다. `archive_mode=on`과 `archive_command='cp %p /tmp/pitr-wal/%f'`를 사용하고, PostgreSQL 사용자가 쓸 수 있는 보관 디렉터리를 준비한다. `%p`는 원본 WAL 경로, `%f`는 WAL 파일 이름이다. `/tmp` 보관은 격리 실습용이다.
2. `events` 테이블에 1번 행을 넣고 `pg_basebackup -X stream`으로 기본 백업을 뜬다.
3. 백업 후 2번 행을 넣어 커밋하고 `SELECT pg_create_restore_point('before_delete');`로 WAL에 이름 있는 복구 지점을 만든다.
4. 2번 행을 삭제하고 3번 행을 넣는다. `SELECT pg_switch_wal();`로 세그먼트 전환을 요청하고, 복구 지점이 포함된 WAL 파일이 보관 위치에 존재하는지 확인한다.
5. 기본 백업의 데이터 디렉터리에 `recovery.signal`을 만들고 `restore_command = 'cp /tmp/pitr-wal/%f %p'`, `recovery_target_name = 'before_delete'`, `recovery_target_action = 'promote'`를 설정한다. 복구 인스턴스를 별도 포트로 시작한다.
6. 로그에 `recovery stopping at restore point "before_delete"`가 찍히고 복구본에서 1번과 2번이 조회되는지 확인한다.

자동 격리 실습에서 **삭제 이후 원본은 1·3번, 삭제 직전 복원본은 1·2번**이었다. 임시 컨테이너와 볼륨을 정리했다. 이후 수동 따라 하기는 `SHOW archive_mode;`에서 `on`을 확인한 뒤 중단했다.

아래는 자동 실습에서 사용한 핵심 명령이다. 임시 컨테이너 안에서 OS 사용자 `postgres`로 실행했고, WAL 경로는 1단계 설정에 맞췄다.

```sh
pg_basebackup -U postgres -D /tmp/pitr-restored -X stream -c fast
```

```sql
INSERT INTO events VALUES (2);
SELECT pg_create_restore_point('before_delete');
DELETE FROM events WHERE id = 2;
INSERT INTO events VALUES (3);
SELECT pg_switch_wal();
```

아래 내용을 복원본의 `postgresql.auto.conf`에 추가한 뒤 복구 인스턴스를 띄운다.

```ini
restore_command = 'cp /tmp/pitr-wal/%f %p'
recovery_target_name = 'before_delete'
recovery_target_action = 'promote'
```

```sh
touch /tmp/pitr-restored/recovery.signal
pg_ctl -D /tmp/pitr-restored -l /tmp/pitr-recovery.log -o '-p 5544 -c archive_mode=off' -w start
psql -U postgres -p 5544 -d pitr_lab -c 'SELECT id FROM events ORDER BY id;'
```

## 5. 운영에서 백업을 보관하는 예

GitLab이 공개한 PostgreSQL 사례에서는 기본 백업과 WAL을 Google Cloud Storage에 보관했다. Uber는 DB별 스냅샷을 객체 저장소에 올리고 복원 검증을 자동화한다. 관리형 Cloud SQL은 별도 프로젝트의 Backup Vault를 사용하는 강화 백업을 제공한다. [GitLab PostgreSQL 복구](https://about.gitlab.com/blog/delayed-replication-for-disaster-recovery-with-postgresql/) · [Uber 백업·복구](https://www.uber.com/ca/en/blog/robust-database-backup-recovery-at-uber/) · [Cloud SQL 백업 옵션](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backup-options)
