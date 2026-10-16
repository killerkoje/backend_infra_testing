# HTTP와 WebSocket

## HTTP 요청과 응답

일반적인 HTTP 통신은 Client가 요청하고 Server가 응답하는 단위로 처리된다.

```text
Client → HTTP Request → Server
Client ← HTTP Response ← Server
```

NestJS REST API에서는 URL과 HTTP Method가 Controller 메서드를 선택한다.

```text
POST /users
→ UsersController.create()
→ UsersService.create()
→ UsersRepository
→ PostgreSQL
→ 201 Created
```

각 요청은 독립적이다. HTTP Keep-Alive로 TCP Connection을 재사용할 수는 있지만, 이것이 Server가 원하는 시점에 Client로 지속적으로 Event를 보내는 양방향 통신을 의미하지는 않는다.

## WebSocket이 필요한 경우

WebSocket은 연결을 유지하면서 Client와 Server가 서로 원하는 시점에 Message를 보낼 수 있는 전이중 통신 방식이다.

```text
Client ⇄ Server
```

사용 사례:

```text
채팅
실시간 알림
작업 진행률
게임 상태 동기화
실시간 Dashboard
```

모든 API를 WebSocket으로 만들 필요는 없다.

```text
사용자 생성·조회·수정
→ HTTP가 단순하고 적합

서버가 처리 진행률을 계속 전달
→ WebSocket을 고려
```

## WebSocket 연결 시작

WebSocket은 먼저 HTTP 요청으로 연결 전환을 협상한다.

```text
TCP Connection
→ HTTP Upgrade Request
→ 101 Switching Protocols
→ 같은 Connection에서 WebSocket Message 교환
```

대표적인 요청 Header:

```http
Connection: Upgrade
Upgrade: websocket
```

전환이 성공한 뒤에는 매 Message마다 새로운 HTTP Request와 Response를 만드는 방식이 아니라 열린 연결 위에서 WebSocket Frame을 주고받는다.

## ws와 wss

```text
ws://  → 암호화되지 않은 WebSocket
wss:// → TLS로 암호화된 WebSocket
```

브라우저가 HTTPS Page에서 연결한다면 일반적으로 `wss://`를 사용해야 한다. 운영 환경에서는 Nginx 같은 Reverse Proxy가 TLS를 처리하고 내부의 WebSocket Server로 연결을 중계할 수 있다.

```text
Browser
→ wss://api.example.com/socket
→ Nginx :443
→ ws://backend:3001/socket
→ NestJS
```

## HTTP와 WebSocket 선택 기준

```text
HTTP
→ 요청과 응답이 명확함
→ Stateless API에 적합
→ Cache, Retry, 관측이 비교적 단순함

WebSocket
→ 연결을 오래 유지함
→ 낮은 지연의 양방향 통신에 적합
→ 연결 관리, 재연결, 인증 갱신, Scale-out이 더 복잡함
```

WebSocket 연결이 끊길 수 있으므로 Client는 재연결 정책이 필요하다. Message 중복이나 누락이 중요한 업무에서는 Message ID, 마지막 수신 위치, 멱등성 같은 별도 설계도 필요하다.
