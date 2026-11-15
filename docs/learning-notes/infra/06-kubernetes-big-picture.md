# Kubernetes — 전체 숲 보기

**Cluster가 전체 환경이고, 그 안에 Node들이 있다.**
Control Plane의 Scheduler가 Pod를 실행할 Node를 고른다.

```mermaid
flowchart TB
  subgraph cluster["Kubernetes Cluster · 전체 환경"]
    direction TB

    subgraph control["Control Plane · 클러스터 관리"]
      scheduler["Scheduler<br/>Pod를 실행할 Node 선택"]
    end

    subgraph node["선택된 Node · 실제 서버 또는 VM"]
      agent["kubelet + 컨테이너 런타임<br/>할당된 Pod 실행"]
      subgraph pod["Pod · 실행 단위"]
        container["Container<br/>백엔드 프로그램 실행"]
      end
      agent --> container
    end

    scheduler -->|"Pod를 이 Node에 배치"| agent
  end

  style cluster fill:#f8fafc,stroke:#64748b,color:#0f172a
  style control fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  style node fill:#dcfce7,stroke:#16a34a,color:#14532d
  style pod fill:#fef3c7,stroke:#d97706,color:#78350f
  style scheduler fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
  style agent fill:#f0fdf4,stroke:#16a34a,color:#14532d
  style container fill:#fffbeb,stroke:#d97706,color:#78350f
```

- **포함 관계:** Cluster → Node → Pod → Container.
- **관리 흐름:** Control Plane 안의 Scheduler가 Node 선택 → 해당 Node에서 Pod 실행.
- **현재 네 환경:** Ubuntu VM 한 대가 Control Plane 역할과 앱 실행 역할을 모두 맡는다.

그림은 관리와 실행 역할을 구분한 것이다. Scheduler의 배치 결정은 API Server를 통해 전달되며, 실제 실행은 Node가 담당한다.
