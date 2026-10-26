# Kubernetes 구조

```mermaid
flowchart TB
    subgraph K8S["쿠버네티스 (K8S) 시스템 전체"]
        subgraph Cluster["클러스터"]
            CP["컨트롤 플레인<br/>지시 · 배정 · 스케줄링"]

            subgraph Worker["워커 노드"]
                direction LR
                Kubelet["쿠블렛<br/>파드 실행 및 관리"]

                subgraph Pod["파드 (Pod)"]
                    Container["백엔드 컨테이너<br/>실제 애플리케이션 실행"]
                end

                Kubelet -->|실행 · 관리| Pod
            end

            CP -->|파드 배정| Worker
        end
    end

    style CP fill:#eeeeff,stroke:#7265dc,color:#37308c
    style Worker fill:#e0f5ed,stroke:#25846c,color:#075b47
    style Kubelet fill:#ffffff,stroke:#bbbbbb,color:#222222
    style Pod fill:#ffffff,stroke:#bbbbbb,color:#222222
    style Container fill:#f3f1eb,stroke:#999999,color:#333333
```

## 구성 요소

| 구성 요소 | 역할 |
| --- | --- |
| 클러스터 (Cluster) | 여러 노드를 하나로 묶어 관리하는 K8S 환경 |
| 컨트롤 플레인 (Control Plane) | 파드 배치 결정, 상태 관리, 스케줄링 |
| 워커 노드 (Worker Node) | 실제 애플리케이션이 실행되는 서버 |
| 쿠블렛 (Kubelet) | 노드에서 파드가 정상 실행되도록 관리 |
| 파드 (Pod) | 컨테이너를 실행하는 K8S의 최소 배포 단위 |
| 컨테이너 (Container) | FastAPI, Spring Boot 등 실제 백엔드 실행 환경 |
