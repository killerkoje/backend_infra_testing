# Minikube·Pod·Deployment·Service

## 현재 실습 환경

Windows용 Minikube와 Docker Driver를 사용해 단일 Node Kubernetes Cluster를 실행한다.

```text
Windows PowerShell
├── minikube
└── kubectl
     ↓
Kubernetes API Server
     ↓
Minikube Node
├── Debian GNU/Linux 12
├── Kubernetes v1.37.0
└── containerd 2.3.4
```

실습에서 확인한 Node:

```text
Name          minikube
Status        Ready
Role          control-plane
Internal IP   192.168.49.2
External IP   없음
```

Windows에서 명령을 실행하지만 실제 Pod와 Container는 Minikube의 Linux Node에서 실행된다.

## minikube와 kubectl

```text
minikube
→ 로컬 Kubernetes Cluster 생성·시작·정지·삭제

kubectl
→ Kubernetes API Server에 Resource 조회·생성·변경·삭제 요청
```

```powershell
minikube status
kubectl get nodes
kubectl get nodes -o wide
```

`kubectl`은 Pod나 Container를 직접 조작하지 않는다. API Server에 요청하고 Kubernetes의 Control Plane과 Node의 kubelet이 실제 상태를 변경한다.

## Cluster와 Node

```text
Cluster
→ Kubernetes가 관리하는 전체 환경

Node
→ Pod와 Container가 실제로 실행되는 Machine
```

Minikube 학습 Cluster에서는 하나의 Node가 Control Plane과 Worker 역할을 함께 수행한다.

```text
Minikube Cluster
└── minikube Node
    ├── Control Plane 구성요소
    └── Application Pod 실행
```

운영 Cluster에서는 Control Plane과 여러 Worker Node를 분리할 수 있다.

## Pod

Pod는 Kubernetes가 배포하는 가장 작은 실행 단위다. 일반적인 Application Pod에는 Container 하나가 들어가지만 필요하면 여러 Container가 Network와 Volume을 공유할 수 있다.

```text
Pod
└── Nginx Container
    └── Nginx Process
```

첫 실습 Pod:

```powershell
kubectl run nginx-dtudy --image=nginx:alpine
kubectl get pods -o wide
kubectl describe pod nginx-dtudy
```

실습 당시 상태:

```text
Pod IP       10.244.0.3
Node         minikube
Container    nginx:alpine
Status       Running
Ready        1/1
Restart      0
```

Pod 이름의 `dtudy`는 실습 중 입력한 이름이며 동작에는 영향을 주지 않았다.

### Pod 생성 과정

`kubectl describe pod`의 Event에서 다음 순서를 확인했다.

```text
Scheduled
→ Scheduler가 minikube Node 선택

Pulling / Pulled
→ kubelet이 Container Image 준비

Created
→ Container 생성

Started
→ Container Process 실행
```

역할:

```text
Scheduler
→ Pod를 실행할 Node 결정

kubelet
→ Node에서 Pod 상태 관리

containerd
→ 실제 Container 생성·실행
```

## Pod 내부 Port와 port-forward

Nginx Process는 Pod Network 안의 80번 Port에서 Listen한다.

```text
Pod 10.244.0.3
└── Nginx Container
    └── Nginx Process :80
```

다음 명령으로 Windows에서 Pod까지 임시 통로를 만들었다.

```powershell
kubectl port-forward pod/nginx-dtudy 8080:80
```

Port의 소유자:

```text
Windows :8080
→ Windows에서 실행 중인 kubectl이 Listen

Pod :80
→ Pod 내부의 Nginx Process가 Listen
```

요청 흐름:

```text
Browser
→ Windows localhost:8080
→ kubectl port-forward
→ Kubernetes API Server
→ minikube Node의 kubelet
→ nginx-dtudy Pod :80
→ Nginx Process
```

`localhost:8080`이라는 주소 자체가 Backend를 의미하는 것은 아니다. 어떤 Process가 해당 Network 공간의 Port를 열었는지가 중요하다. 이 실습에서는 NestJS가 아니라 `kubectl`이 Windows의 8080을 열었다.

```text
localhost:3001
→ Windows에서 실행한 NestJS가 Listen

localhost:8080
→ kubectl이 Listen하고 Pod :80으로 전달
```

`port-forward`는 Service와 Ingress를 거치지 않는 개발·디버깅용 임시 연결이다. 명령을 `Ctrl+C`로 종료하면 Windows의 8080 통로만 사라지고 Pod와 Nginx는 계속 실행된다.

## Label과 Selector

Label은 Kubernetes Resource를 분류하는 `key=value` Metadata다.

```text
app=nginx-deployment
```

Selector는 원하는 Label을 가진 Resource를 선택하는 조건이다.

```text
Pod Label
→ app=nginx-deployment

Service Selector
→ app=nginx-deployment

일치
→ Service 연결 대상이 됨
```

Label 선택과 실제 Traffic 전달을 구분한다.

```text
선택
→ Label과 Selector 사용

실제 전송
→ 선택 결과인 Pod IP와 Port 사용
```

## Service

Pod IP는 Pod가 교체되면 바뀔 수 있다. Service는 Client에 고정된 Cluster 내부 IP와 DNS를 제공하고 현재 선택된 Pod로 요청을 전달한다.

실습 Service:

```powershell
kubectl expose pod nginx-dtudy `
  --name=nginx-service `
  --port=80 `
  --target-port=80 `
  --type=ClusterIP
```

```text
Service Name     nginx-service
Type             ClusterIP
Cluster IP       10.96.234.80
Service Port     80
Target Port      80
External IP      없음
```

Port 의미:

```text
port: 80
→ Service가 Cluster 내부에서 요청을 받는 Port

targetPort: 80
→ 선택된 Pod에서 요청을 전달할 Port
```

`ClusterIP` Service는 Cluster 내부 전용이다. 외부 Browser에 직접 공개되지 않는다.

### Service DNS

```text
전체 이름
→ nginx-service.default.svc.cluster.local

같은 default Namespace의 짧은 이름
→ nginx-service
```

Client는 변할 수 있는 Pod IP 대신 Service DNS를 사용한다.

```text
Client
→ http://nginx-service
→ Service
→ 현재 선택된 Pod
```

외부 사용자가 쓰는 `backend.local` 같은 Domain과 Kubernetes 내부 Service DNS는 별개다. 외부 Domain은 이후 Ingress 진입점에 연결한다.

## EndpointSlice

Service는 Selector와 일치하는 Pod를 찾고 Kubernetes는 실제 Pod IP 목록을 EndpointSlice에 기록한다.

```powershell
kubectl get endpointslice `
  -l kubernetes.io/service-name=nginx-service `
  -o wide
```

첫 Pod를 연결했을 때:

```text
Service Selector
→ run=nginx-dtudy

EndpointSlice
→ 10.244.0.3:80
```

정리:

```text
Service
→ Label로 연결 대상 선언

EndpointSlice
→ 현재 일치하는 실제 Pod IP 목록

Kubernetes Network
→ EndpointSlice의 Pod IP로 Traffic 전달
```

Service의 Selector에 오타가 있어 Pod Label과 일치하지 않았을 때 Endpoint가 `<unset>`이 되는 것도 확인했다.

```text
잘못된 Selector
→ app=nginx-deplyment

실제 Pod Label
→ app=nginx-deployment

결과
→ 일치하는 Pod 없음
→ Endpoint 없음
```

Selector를 수정하자 Endpoint가 자동으로 등록됐다.

## Deployment와 ReplicaSet

직접 생성한 Pod는 삭제해도 다시 만들어지지 않았다. Deployment는 원하는 Pod Template과 개수를 선언하고 그 상태를 유지한다.

```powershell
kubectl create deployment nginx-deployment `
  --image=nginx:alpine `
  --replicas=2
```

관리 구조:

```text
Deployment
→ ReplicaSet
→ Pod 2개
```

역할:

```text
Deployment
→ Pod Template과 배포 버전 관리
→ Rolling Update와 Rollback 관리

ReplicaSet
→ 지정한 replicas 수 유지

Pod
→ Nginx Container 실제 실행
```

실습에서 생성된 두 Pod:

```text
10.244.0.4
10.244.0.5
```

공통 Label:

```text
app=nginx-deployment
```

Service Selector를 같은 Label로 변경했다.

```powershell
kubectl set selector service nginx-service app=nginx-deployment
```

그 결과:

```text
nginx-service 10.96.234.80:80
├── Pod 10.244.0.4:80
└── Pod 10.244.0.5:80
```

Service는 Deployment로 Traffic을 보내는 것이 아니다. Deployment는 통신 경로에 포함되지 않는다.

```text
관리 경로
Deployment → ReplicaSet → Pod 생성·유지

통신 경로
Client → Service → Pod → Nginx
```

두 경로는 Pod의 Label에서 연결된다.

## Desired State와 자동 복구

Deployment의 `replicas=2`는 Nginx Pod 두 개를 유지하겠다는 원하는 상태다.

Pod `10.244.0.4`를 삭제했을 때 다음 변화가 발생했다.

```text
원하는 상태
→ Pod 2개

실제 상태
→ Pod 삭제 후 1개

ReplicaSet
→ 차이를 감지
→ 새로운 Pod 생성

복구 결과
├── 기존 Pod 10.244.0.5
└── 새 Pod   10.244.0.6
```

Kubernetes는 삭제된 Pod를 되살리지 않고 같은 Template으로 새 Pod를 만든다. 따라서 Pod 이름과 IP가 변경된다.

Service EndpointSlice도 자동으로 갱신됐다.

```text
변경 전
→ 10.244.0.4, 10.244.0.5

변경 후
→ 10.244.0.5, 10.244.0.6
```

Client는 내부 교체와 관계없이 계속 같은 Service 주소를 사용한다.

```text
http://nginx-service
```

## 현재 실습 상태

```text
Minikube Node
└── nginx-deployment
    └── ReplicaSet
        ├── Pod 10.244.0.5
        └── Pod 10.244.0.6

nginx-service
├── ClusterIP 10.96.234.80:80
├── Endpoint 10.244.0.5:80
└── Endpoint 10.244.0.6:80
```

현재까지는 명령형 명령으로 Resource를 생성했다. 다음 단계에서는 같은 구성을 YAML로 선언해 `kubectl apply`하고, ConfigMap·Secret·Ingress로 확장한다.

## 현재까지 사용한 확인 명령

```powershell
kubectl get nodes -o wide
kubectl get pods -o wide --show-labels
kubectl describe pod <pod-name>
kubectl get deployments
kubectl get replicasets
kubectl get services -o wide
kubectl get endpointslice -o wide
kubectl exec <pod-name> -- <command>
kubectl port-forward pod/<pod-name> 8080:80
```

문제가 생기면 다음 순서로 확인한다.

```text
Deployment의 replicas가 충족됐는가?
→ Pod가 Running·Ready 상태인가?
→ Pod Label과 Service Selector가 일치하는가?
→ EndpointSlice에 Pod IP와 targetPort가 있는가?
→ Container Process가 targetPort에서 Listen하는가?
```
