# Reverse Proxy·Nginx·TLS

## Reverse Proxy

Reverse Proxy는 외부 Client의 요청을 먼저 받은 뒤 내부 Backend Server로 전달한다.

```text
Client
→ https://api.example.com:443
→ Nginx
→ http://backend:3001
→ NestJS
```

사용자 URL에 `3001`이 없어도 연결되는 이유:

```text
https://의 기본 Port 443으로 Nginx에 연결
→ Nginx가 443에서 요청 수신
→ proxy_pass 설정으로 내부 3001에 전달
```

외부 Client는 Nginx의 주소와 Port만 알면 된다. Backend의 내부 주소와 Port는 직접 공개하지 않아도 된다.

## 두 개의 통신 구간

Proxy를 거치는 통신은 논리적으로 두 구간이다.

```text
1. Client ↔ Nginx
2. Nginx  ↔ NestJS
```

Nginx는 Client의 요청을 받은 뒤 Backend에 Proxy Request를 만들고, Backend Response를 다시 Client에 전달한다.

```text
Client → Nginx Request
Nginx  → NestJS Proxy Request
NestJS → Nginx Response
Nginx  → Client Response
```

## Nginx HTTP Proxy

기본 형태:

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    location /api/ {
        proxy_pass http://backend:3001;
    }
}
```

```text
https://api.example.com/api/users
→ Nginx :443
→ http://backend:3001/api/users
```

`proxy_pass` 뒤 URL의 경로와 `location`의 끝 Slash 조합에 따라 Backend에 전달되는 Path가 달라질 수 있으므로 실제 설정에서는 전달 Path를 검증해야 한다.

## Forwarded Header

Backend 관점에서 직접 연결한 상대는 Client가 아니라 Nginx다. 원래 요청 정보를 전달하기 위해 Header를 설정한다.

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

```text
Host
→ 사용자가 요청한 Domain

X-Real-IP
→ Nginx가 본 Client IP

X-Forwarded-For
→ 거쳐 온 Proxy와 Client IP Chain

X-Forwarded-Proto
→ 원래 요청 Scheme, http 또는 https
```

Forwarded Header는 신뢰할 수 있는 Proxy가 덮어쓰거나 추가하도록 구성해야 한다. 외부 Client가 임의로 보낸 값을 그대로 신뢰하면 IP 기반 보안이나 HTTPS 판단을 우회할 수 있다.

## WebSocket Proxy

WebSocket은 HTTP Upgrade Handshake를 통과시켜야 한다.

```nginx
location /socket {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

설정이 없으면 일반 HTTP API는 동작하지만 WebSocket Upgrade만 실패할 수 있다.

연결 후 Nginx는 양쪽의 지속 연결을 중계한다.

```text
Client ⇄ WebSocket ⇄ Nginx ⇄ WebSocket ⇄ NestJS
```

WebSocket은 오래 유지되므로 Proxy Timeout, Backend 재시작, Client 재연결 정책도 함께 고려해야 한다.

## TLS Termination

Nginx가 인증서를 가지고 외부 TLS Connection을 복호화하는 지점을 TLS Termination이라고 한다.

```text
Client
→ HTTPS/WSS로 암호화
→ Nginx에서 TLS 종료
→ 내부 HTTP/WS
→ NestJS
```

장점:

```text
인증서 관리를 Nginx에 집중
Backend는 Application 처리에 집중
여러 Backend에 공통 TLS 정책 적용
```

내부 Network도 신뢰할 수 없거나 규정상 암호화가 필요하면 Nginx와 Backend 사이에도 TLS를 사용할 수 있다.

NestJS가 내부에서 HTTP 요청을 받더라도 `X-Forwarded-Proto: https`를 통해 원래 Client가 HTTPS로 접속했음을 알 수 있다. 다만 Application에서 Proxy를 신뢰하도록 명시적으로 설정하고, 신뢰할 Proxy 범위를 제한해야 한다.

## Minikube Ingress TLS 실습

현재 학습 Cluster에서는 `backend.local`용 자체 서명 인증서를 Kubernetes TLS Secret으로 저장하고 Ingress Controller에서 TLS를 종료한다.

```text
Client
→ HTTPS :443
→ ingress-nginx-controller
→ TLS Secret: backend-local-tls
→ HTTP
→ backend-service:3000
→ Backend Pod
```

Ingress의 핵심 설정:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - backend.local
      secretName: backend-local-tls
```

`backend-local-tls` Secret에는 다음 Key가 들어간다.

```text
tls.crt → 공개 인증서
tls.key → 개인키
```

자체 서명 인증서는 공인 CA가 서명하지 않았으므로 Browser와 `curl`이 기본적으로 신뢰하지 않는다. 로컬 검증에서 `curl -k`를 사용할 수 있지만, 이는 인증서 검증을 생략하므로 운영 환경에서는 사용하지 않는다.

운영 환경에서는 일반적으로 cert-manager와 Let's Encrypt 같은 CA를 사용해 인증서 발급과 갱신을 자동화한다. 개인키나 실제 인증서 값을 Git에 Commit하지 않는다.

검증 흐름:

```text
HTTP 요청
→ HTTPS로 Redirect

HTTPS 요청
→ Ingress Controller가 TLS Handshake 처리
→ Backend의 /health/live
→ 200 OK
```

## 외부 공개 원칙

```text
80, 443
→ Reverse Proxy에서 외부 공개

3001
→ Backend 내부 통신용

5432
→ Database 내부 통신용
```

Backend와 DB Port를 외부에 직접 공개하지 않으면 공격 표면을 줄이고 진입점을 Nginx로 통제할 수 있다.

## 장애 확인 순서

```text
1. DNS가 올바른 IP를 반환하는가?
2. Server의 80/443 Port가 열려 있는가?
3. TLS 인증서와 Handshake가 정상인가?
4. Nginx가 요청을 받았는가?
5. proxy_pass 대상 주소와 Port가 올바른가?
6. Backend Process가 실행 중이고 Listen 중인가?
7. 일반 HTTP는 되고 WebSocket Upgrade만 실패하는가?
8. Firewall, Timeout, WebSocket Header 설정은 올바른가?
```
