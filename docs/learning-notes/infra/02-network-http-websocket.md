# Network·HTTP·WebSocket

## IP와 Port

IP Address는 Network에서 Host 또는 Network Interface의 위치를 식별하고, Port는 그 Host 안에서 요청을 받을 Process를 구분한다.

```text
IP   → 어느 Computer인가
Port → 그 Computer의 어느 Service인가
```

```text
192.168.0.10:3001
└── Host IP     └── NestJS Port
```

같은 Port라도 서로 다른 IP에서는 각각 사용할 수 있다. 한 Host의 동일 IP와 Port 조합은 일반적으로 하나의 Listen Socket만 사용할 수 있다.

## localhost와 Network 경계

`localhost`와 `127.0.0.1`은 현재 Network Namespace 자기 자신을 가리킨다.

```text
Host의 localhost
→ Host

Container A의 localhost
→ Container A

Container B의 localhost
→ Container B
```

따라서 `localhost:3001`이 누구의 `localhost`인지 항상 실행 위치부터 확인해야 한다.

## Private Network와 Public Network

```text
Private IP
→ 내부 Network에서 사용
→ Internet에서 직접 Routing되지 않음

Public IP
→ Internet에서 접근 가능한 주소
→ Firewall과 Port 공개 정책 필요
```

내부 Backend Port를 Public Internet에 직접 공개할 필요는 없다. 일반적으로 Reverse Proxy의 80/443만 공개하고 Backend와 DB Port는 내부 Network에 둔다.

## DNS

DNS는 사람이 사용하는 Domain Name을 Connection에 필요한 IP Address로 변환한다.

```text
api.example.com
→ DNS 조회
→ Public IP
→ 해당 Server로 Connection
```

DNS는 Backend의 `3001` 같은 Application Port까지 대신 찾아주는 기능이 아니다. URL Scheme의 기본 Port나 URL에 명시된 Port를 사용한다.

```text
http://  → 기본 80
https:// → 기본 443
```

## TCP

TCP는 연결 기반 전송 Protocol이다. Data의 순서와 재전송을 관리해 Application에 신뢰할 수 있는 Byte Stream을 제공한다.

```text
Client
→ TCP Connection 생성
→ Application Data 전송
→ Connection 종료
```

HTTP/1.1과 WebSocket은 일반적으로 TCP 위에서 동작한다. HTTPS와 WSS는 그 사이에 TLS 암호화 계층이 추가된다.

```text
HTTP      → TCP
HTTPS     → TLS → TCP
WebSocket → TCP
WSS       → TLS → TCP
```

## HTTP와 HTTPS

HTTP는 Request와 Response Message 규칙을 정의하는 Application Protocol이다.

```text
Request
→ Method, Path, Header, Body

Response
→ Status Code, Header, Body
```

HTTPS는 HTTP Message를 TLS로 암호화해 전송한다.

```text
HTTPS = HTTP over TLS
```

TLS는 전송 내용 암호화, Server 신원 확인, 전송 중 변조 탐지를 제공한다.

## WebSocket

WebSocket은 지속적인 양방향 통신이 필요할 때 사용한다.

시작 과정:

```text
TCP Connection
→ HTTP Upgrade Handshake
→ 101 Switching Protocols
→ WebSocket Connection 유지
→ 양방향 Message 교환
```

일반 HTTP와 비교:

```text
HTTP
→ Client가 요청
→ Server가 응답
→ 요청 단위 처리

WebSocket
→ 연결 유지
→ Client와 Server 모두 원하는 시점에 전송
```

WebSocket은 실시간 기능에 유용하지만 연결 상태를 Server가 관리해야 한다. 여러 Backend Instance로 확장하면 어느 Instance에 어떤 Client가 연결되어 있는지, Instance 사이 Event를 어떻게 공유할지 고려해야 한다.

## 전체 통신 흐름

```text
Browser
→ DNS로 api.example.com의 IP 확인
→ Server의 443 Port에 TCP Connection
→ TLS Handshake
→ HTTP Request 또는 WebSocket Upgrade
→ Reverse Proxy
→ 내부 Backend
```

문제가 생기면 이 순서에 따라 DNS, Port, TLS, Proxy, Backend를 분리해 확인한다.
