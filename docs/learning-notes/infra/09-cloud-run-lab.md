# Cloud Run 배포·인증·트래픽 분할·오토스케일링

2026년 11월 24~25일 실습. 로컬에서 만든 Node.js HTTP 서버를 이미지로 배포하고, 인증된 호출부터 요청 추적, 리비전 분할, 인스턴스 확장까지 확인했다.

## 1. 이미지 빌드와 자동 배포

- `demo/`에는 DB 없이 동작하는 Node.js 데모가 있다. 컨테이너는 Cloud Run이 전달하는 `PORT`에서 요청을 받고, 응답의 `revision`에는 `K_REVISION`을 표시한다.
- `main` 푸시 → Cloud Build 트리거 → Docker Buildx로 `linux/amd64,linux/arm64` 이미지 빌드 → Artifact Registry에 커밋 태그로 푸시 → Cloud Run `hello` 배포 순으로 이어진다. 설정은 [cloudbuild.yaml](../../../cloudbuild.yaml)에 있다.
- 프로젝트는 `mineral-brand-515105-e3`, Cloud Run과 Artifact Registry는 서울(`asia-northeast3`), Cloud Build 트리거는 `global`이다. 11월 24일 커밋 `51de4b1`의 트리거 실행은 `SUCCESS`였다. 기본 서비스 리비전 `hello-00010-jq7`에는 이후 빌드한 이미지 태그 `3c3d833dd870`이 배포됐다.

## 2. 로컬 브라우저에서 인증 호출과 요청 추적

1. 로컬 PowerShell에서 `gcloud auth login`을 실행하고 브라우저에서 로그인한다. `gcloud auth list`의 별표가 활성 계정이다.
2. 실습용 로컬 Node 서버를 실행하고 `http://127.0.0.1:3000`의 Hello 버튼을 누른다. 당시 로컬 호출 도구는 `demo/hello-local.mjs`에서 작업했다.
3. 로컬 서버가 UUID를 만들고 서비스 계정을 가장해 Cloud Run용 ID 토큰을 발급한다. 호출에는 `Authorization: Bearer …`와 `X-Request-ID`를 보낸다. 태그 URL을 호출하더라도 토큰의 대상은 기본 서비스 URL이다.
4. 화면에 표시된 요청 ID를 Cloud Logging의 `jsonPayload.requestId`에서 찾아 같은 요청인지 확인했다. 로그의 `labels.instanceId`로 어느 인스턴스에서 처리했는지도 구분할 수 있다.

Google Cloud API 조회에는 gcloud의 **액세스 토큰**, Cloud Run 애플리케이션 호출에는 **ID 토큰**을 사용한다. [Cloud Run 서비스 간 인증](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)

## 3. 리비전 분할과 인스턴스 확장

- **리비전 분할**은 같은 서비스 URL의 요청을 서로 다른 앱 버전에 배분한다. `hello-00009-kv6`와 `hello-00010-jq7`을 각각 50%로 설정해 응답의 `revision`을 확인한 뒤 최신 리비전인 `hello-00010-jq7`에 100%를 돌렸다. 50:50이어도 요청이 번갈아 들어갈 필요는 없다. 이전 버전으로 되돌릴 때도 트래픽 배분을 바꾼다. [리비전 트래픽 관리](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
- **오토스케일링**은 요청 동시성이나 CPU 사용률에 맞춰 같은 리비전의 인스턴스 수를 조절한다. GKE에서도 HPA는 목표 부하에 맞춰 필요한 파드 수를 조절하고, Deployment의 자동 복구는 사라진 파드를 대체해 목표 개수를 유지한다. [Cloud Run 오토스케일링](https://docs.cloud.google.com/run/docs/about-instance-autoscaling)
- 11월 24일 서비스 수준 최대 인스턴스 변경 기록은 한국 시간으로 17:49에 1 → 2, 17:52에 2 → 1, 17:53에 1 → 2였다.

## 4. 동시 요청으로 1 → 2 확장 확인

`GET /slow`에 3초 비동기 대기를 추가했다. 이전 요청이 응답하기 전에 새 요청이 도착하면 처리 중인 요청이 겹친다. 대기 자체는 CPU를 거의 쓰지 않아 동시 요청으로 확장되는 상황을 관찰할 수 있다.

- `scale-lab` 태그를 단 테스트 리비전은 `hello-00019-dir`이다. 인스턴스당 동시 요청 한도 1, 리비전 최대 인스턴스 2, 최소 0으로 실습했다. 기본 서비스 트래픽은 `hello-00010-jq7`에 100%를 유지했다.
- 기준 요청 1개 후 `/slow` 요청 4개를 동시에 보냈다. 모두 HTTP 200이었다. 같은 리비전에서 서로 다른 `instanceId` 두 개와 `Reason: AUTOSCALING` 로그를 확인했다.
- 요청이 끝난 후 Monitoring에서 한국 시간 09:31에 활성 2개, 09:32에 활성 1개·유휴 1개, 09:35와 09:40에 활성 0개·유휴 2개, 09:42에 활성 0개·유휴 1개를 확인했다. 유휴 인스턴스는 새 요청을 처리할 수 있는 대기 상태다. 같은 시각의 두 수치를 더하면 전체 개수다.
- 이후 Cloud Monitoring 대시보드에서 활성 0개·유휴 0개를 확인해 전체 인스턴스가 0개까지 줄어드는 것을 검증했다.
- 한국 시간 10:02에 태그 URL의 `/slow`를 다시 한 번 호출했다. Cloud Logging에서 새 인스턴스의 `AUTOSCALING` 시작 로그와 같은 인스턴스의 요청 로그를 확인했다. 응답은 HTTP 200이었고 전체 호출에 약 4초가 걸렸다. 이 시간에는 경로에 넣은 3초 대기와 네트워크 시간도 포함된다.
- 서비스 수준 상한은 변경 즉시 적용된다. 이미 떠 있는 인스턴스의 종료 시점은 별개다. 기본 트래픽 배분에 없는 태그 리비전에는 서비스 상한이 적용되지 않는다. 그 리비전의 최대를 바꾸려면 같은 이미지로 설정을 바꿔 새 리비전을 배포한다. 최소 0은 유휴 상태에서 0개까지 줄 수 있다는 뜻이다. [인스턴스 상한](https://docs.cloud.google.com/run/docs/configuring/max-instances)

## 5. PowerShell 조회 명령

로컬 PowerShell에서 아래 명령을 실행한다. Cloud Shell이나 VM에 접속할 필요 없이 Google Cloud API를 조회한다.

```powershell
gcloud auth list
gcloud config get-value project
gcloud config set project mineral-brand-515105-e3
gcloud run services list --region=asia-northeast3
gcloud run services describe hello --region=asia-northeast3
gcloud run revisions list --service=hello --region=asia-northeast3
gcloud run services logs read hello --region=asia-northeast3 --freshness=30m --limit=20
gcloud builds list --region=global --limit=5
```

### 활성·유휴 인스턴스 수

아래 블록 전체를 한 번에 붙여넣는다. 처음 변수 할당 줄은 출력이 없다. `>>`는 PowerShell이 블록이 끝나길 기다리는 표시다. 서비스 URL을 호출하지 않으므로 조회로 인해 유휴 인스턴스가 깨어나지 않는다.

```powershell
& {
    $base = 'https://monitoring.googleapis.com/v3/projects'
    $path = 'mineral-brand-515105-e3/timeSeries'
    $metric = 'metric.type="run.googleapis.com/container/instance_count"'
    $revision = 'resource.labels.revision_name="hello-00019-dir"'
    $filter = [uri]::EscapeDataString("$metric AND $revision")

    $now = [DateTime]::UtcNow
    $start = $now.AddHours(-2).ToString('o')
    $end = $now.ToString('o')

    $url = "$base/$path"
    $url += "?filter=$filter"
    $url += "&interval.startTime=$start"
    $url += "&interval.endTime=$end"

    $token = gcloud auth print-access-token --quiet
    if ($LASTEXITCODE -ne 0 -or -not $token) {
        throw 'gcloud 액세스 토큰을 가져오지 못했다.'
    }

    $headers = @{ Authorization = "Bearer $token" }
    $result = Invoke-RestMethod $url -Headers $headers -ErrorAction Stop

    if (-not $result.timeSeries) {
        '최근 2시간에 조회된 샘플이 없다.'
        return
    }

    foreach ($series in $result.timeSeries) {
        $point = $series.points[0]
        $time = [DateTimeOffset]$point.interval.endTime
        $timeKst = $time.ToOffset([TimeSpan]::FromHours(9))
        "$($series.metric.labels.state) = $($point.value.int64Value)개 ($timeKst)"
    }
}
```

활성·유휴의 **샘플 시각이 같은지** 확인한다. 시계열 개수가 0이거나 최근 샘플이 없으면 조회 범위·시각을 다시 확인한다. API 요청 실패 후에는 결과 배열을 읽기 전에 HTTP 오류를 해결한다. 이 실습에서는 줄바꿈으로 주소에 `{0}` 같은 자리표시자가 남아서 HTTP 400이 반환됐고, 주소를 짧은 줄로 조립한 위 코드로 조회에 성공했다. [Monitoring timeSeries.list](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list)

## 6. 과금과 GPU

- `hello`는 요청 기반 과금과 최소 인스턴스 0을 사용한다. 기존 요청을 처리하거나 인스턴스를 시작·종료하는 시간에는 과금이 발생할 수 있다. 로컬 브라우저 테스트 서버를 켜두는 것만으로 Cloud Run 호출이 발생하지 않는다. [Cloud Run 요금](https://cloud.google.com/run/pricing)
- Compute Engine과 EC2는 각각 일반 VM과 GPU 장착 VM을 제공한다. GPU VM은 CPU·RAM과 GPU·VRAM을 한 인스턴스로 관리한다. Compute Engine의 `g2-standard-4`와 EC2의 `g6.xlarge`는 각각 vCPU 4개, RAM 16GiB, NVIDIA L4 1개를 제공한다. 일부 Compute Engine N1 VM에는 지원 GPU를 추가할 수 있다. [Compute Engine GPU 머신](https://docs.cloud.google.com/compute/docs/gpus/) · [EC2 가속 컴퓨팅](https://aws.amazon.com/ec2/instance-types/accelerated-computing/)
- Cloud Run은 컨테이너 인스턴스에 GPU를 할당한다. GPU 1개 할당 인스턴스가 1 → 2로 늘면 모델을 실행하는 GPU 인스턴스도 두 개가 된다. 모델이 VRAM에 들어가는지와 한 GPU가 감당할 동시 요청 수를 기준으로 구성한다. 기본 확장은 CPU·동시 요청을 기준으로 동작한다. GPU 설정은 개념으로 학습했다. [Cloud Run GPU 설정](https://docs.cloud.google.com/run/docs/configuring/services/gpu) · [GPU 추론 운영](https://docs.cloud.google.com/run/docs/configuring/services/gpu-best-practices)

## 다음 실습

Cloud Build 테스트 단계가 실패하면 기존 리비전이 계속 서비스되는지 검증한다.
