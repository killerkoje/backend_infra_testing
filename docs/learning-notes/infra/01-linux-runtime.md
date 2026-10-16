# Linux 실행 환경

## Process

Process는 실행 중인 Program이다. NestJS Server, PostgreSQL, Nginx는 각각 별도 Process로 실행된다.

```text
Program File
→ OS가 Memory에 적재
→ Process 생성
→ PID 부여
→ CPU Scheduling을 받으며 실행
```

대표적인 확인 명령:

```bash
ps aux
pgrep -a node
top
```

Server가 실행되지 않는다면 먼저 Process가 존재하는지 확인한다. Process가 존재해도 올바른 Port를 Listen하지 않거나 Application 초기화에 실패했을 수 있다.

## Port와 Listen Socket

Server Process는 특정 IP와 Port에 Socket을 열고 Connection을 기다린다.

```text
NestJS Process
→ 0.0.0.0:3001 Listen

Nginx Process
→ 0.0.0.0:80, 0.0.0.0:443 Listen
```

확인 명령:

```bash
ss -lntp
lsof -i :3001
```

`127.0.0.1:3001`에만 Bind하면 같은 Host 내부에서만 접근할 수 있다. `0.0.0.0:3001`은 Host의 모든 IPv4 Interface에서 요청을 받을 수 있다는 뜻이지만, 실제 외부 접근 여부는 Firewall과 Network 설정에도 영향을 받는다.

## Environment Variable

환경변수는 Process가 시작될 때 실행 설정을 전달한다.

```bash
export PORT=3001
export DB_HOST=localhost
```

```text
Shell 환경변수 설정
→ Child Process 실행
→ Node.js의 process.env로 조회
```

실행 중인 Process가 환경변수 변경을 자동으로 다시 읽는 것은 아니다. 일반적으로 설정을 바꾼 뒤 Process를 재시작해야 한다.

## File Permission

Linux Permission은 User, Group, Others가 File을 읽고 쓰고 실행할 수 있는지를 결정한다.

```text
r → read
w → write
x → execute
```

확인과 변경:

```bash
ls -l
chmod
chown
```

Server Process가 Log, Upload, 설정 File을 읽거나 쓰지 못할 때 실행 계정과 Permission을 함께 확인한다. 문제를 빨리 피하려고 모든 File에 과도한 Permission을 주면 보안 문제가 생긴다.

## Log

장애가 발생하면 상태 추측보다 Process와 Application Log를 먼저 확인한다.

```bash
journalctl -u <service-name>
docker logs <container-name>
```

좋은 Log에는 최소한 시간, Log Level, 요청 식별자, 실패 지점과 오류 원인이 있어야 한다. Password, Token, 개인정보는 Log에 남기지 않는다.

## CPU·Memory·Disk

```text
CPU 부족
→ 처리 지연, Event Loop 지연

Memory 부족
→ Swap 사용, OOM Kill, Process 종료

Disk 부족
→ Log 기록 실패, DB Write 실패, Image Pull 실패
```

대표적인 확인 명령:

```bash
top
free -h
df -h
du -sh <path>
```

Process 존재 여부뿐 아니라 Resource 고갈 여부까지 함께 확인해야 한다.
