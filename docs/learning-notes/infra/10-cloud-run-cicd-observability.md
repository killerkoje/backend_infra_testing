# Cloud Run 배포 검증과 5xx 알림

2026-11-25에 `hello` 서비스에서 CI 실패 차단, 트래픽 전환 전 스모크 테스트, 전환 후 응답 검증, 5xx 이메일 알림을 실습했다. 서비스와 Artifact Registry는 서울 리전, Cloud Build 트리거는 `global`을 사용한다. 앞서 실습한 인증·리비전·스케일링은 [Cloud Run 기초 실습](./09-cloud-run-lab.md)에 있다.

## 1. CI에서 실패를 잡아 배포 차단

[cloudbuild.yaml](../../../cloudbuild.yaml)의 첫 단계 `test`는 Node.js 22에서 [demo/server.test.mjs](../../../demo/server.test.mjs)를 실행한다. 테스트는 [서버](../../../demo/server.mjs)를 빈 포트에 직접 띄우고 `GET /`의 HTTP 200, JSON 콘텐츠 유형, 메시지·환경·리비전 값을 검사한다. DB 없이 실행된다.

```powershell
node --test demo/server.test.mjs
```

실패 실험은 로컬 수정본을 별도 복사해 `GET /`만 500으로 바꿔 Cloud Build에 제출했다. 테스트가 `500 !== 200`과 종료 코드 1을 반환했다. 후속 Docker 빌드·푸시·Cloud Run 배포 단계는 시작되지 않았고, 기존 기본 URL은 200을 반환했다. 정상 소스로 다시 실행하면 테스트와 이미지 등록, 트래픽 0% 리비전 배포가 모두 성공했다. 실제 파이프라인의 테스트 단계는 커밋 `51c2096`에 들어갔다.

YAML에는 어떤 검사 명령을 어떤 순서로 실행할지 적고, 응답 내용이나 상태 코드 같은 합격 조건은 테스트 코드에 둔다. 이 검증은 배포 차단을 다룬다. GitHub PR 병합 차단은 별도의 필수 상태 검사 설정이다. [Cloud Build 빌드 설정](https://docs.cloud.google.com/build/docs/build-config-file-schema)

## 2. 0% 배포에서 100% 전환까지

1. Docker Buildx가 `linux/amd64`와 `linux/arm64` 이미지를 빌드하고 Artifact Registry에 커밋의 `$SHORT_SHA` 태그로 올린다.
2. Cloud Run에 `--no-traffic`으로 배포하고 `--tag=smoke-$SHORT_SHA`를 붙인다. 기존 기본 URL의 트래픽은 기존 리비전에 남고, 새 리비전은 별도 태그 URL에서 직접 호출할 수 있다.
3. `check-id-token` 단계가 Cloud Build 메타데이터 서버에서 ID 토큰을 받아 태그 URL에 `GET /`을 보낸다. 토큰의 대상(audience)은 기본 서비스 URL이다. 자동 검사는 HTTP 200을 기대하고, 그 외의 응답이나 인증 실패·타임아웃이면 실패한다.
4. `promote`는 `waitFor: ['check-id-token']`으로 스모크 테스트 성공을 기다린다. `--to-tags=smoke-$SHORT_SHA=100`으로 검사한 태그가 가리키는 리비전에 기본 트래픽을 전환한다.

Artifact Registry 이미지 태그나 다이제스트는 **실행할 이미지**를 식별한다. Cloud Run의 리비전 태그는 **이미 배포된 서버에 요청을 보낼 URL**을 만든다. [Cloud Run 트래픽 전환](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update-traffic)

### 호출 권한과 ID 토큰 발급 권한

- `LEEHEEWON` 트리거의 서비스 계정은 `1056202155531-compute@developer.gserviceaccount.com`이다. 이 계정에는 `hello` 서비스에 대한 Cloud Run 호출자(`roles/run.invoker`)가 이미 있었다.
- 로컬 PowerShell에서는 로그인한 사용자가 서비스 계정을 가장해 단기 ID 토큰을 요청했다. Cloud Build 안에서는 트리거에 지정된 실행 계정의 토큰을 메타데이터 서버에서 받는다.
- 토큰 발급 단계의 HTTP 404는 메타데이터 호스트 이름을 공식 예제의 `metadata`로 바꾼 뒤에도 반복됐다. IAM에서 실행 계정에 `iam.serviceAccounts.getOpenIdToken`이 확인되지 않았다. 해당 서비스 계정 리소스에서 **액세스 권한이 있는 주 구성원**으로 동일한 실행 계정을 지정하고, `roles/iam.serviceAccountOpenIdTokenCreator`를 부여한 다음 재실행하자 `ID token OK`가 찍혔다. 토큰 자체는 로그에 출력하지 않는다. [Cloud Build 서비스 간 인증](https://docs.cloud.google.com/build/docs/securing-builds/authorize-service-to-service-access)

### 확인한 결과

수동으로는 0% 리비전 태그 URL에서 HTTP 200과 응답 JSON의 `revision`을 확인하고, 트래픽을 전환한 뒤 기본 URL도 다시 확인했다. 자동 전환을 연결한 커밋 `192e314`에서는 `smoke-192e314`가 가리키는 `hello-00031-xiq`가 100%, 직전 리비전이 0%였다. 기본 URL에서도 HTTP 200과 `hello-00031-xiq` 응답을 확인했다.

자동 스모크 테스트는 HTTP 상태를 검사한다. JSON 본문과 응답 리비전 이름은 수동 확인에서 비교했다. `promote` 연결 후 스모크 테스트를 의도적으로 실패시키는 재실험은 생략했다. 구성상 해당 단계가 실패하면 `promote`는 실행되지 않고, 새 리비전은 0%에 머문다.

## 3. 배포 후 모니터링

Cloud Run의 **모니터링 가능성 → 측정항목**에서 요청 수의 2xx·4xx·5xx를 보고, **엔드 투 엔드 요청 지연 시간**에서 p50·p95·p99를 읽었다. 확인한 지연 시간은 약 728ms였고, 실습 요청이 적었던 구간에서는 세 백분위가 비슷했다. 개별 호출이 어느 리비전에서 어떤 상태로 끝났는지는 응답 JSON이나 Cloud Logging 요청 로그로 확인한다. Cloud Monitoring은 지표와 알림을, Cloud Logging은 개별 요청 및 앱 로그 탐색을 맡는다.

## 4. HTTP 5xx 이메일 알림

Cloud Run의 요청 수 그래프에서 정책을 만들었다. 콘솔의 정책 표시 이름은 `요청 수`, 이메일 채널 표시 이름은 `Cloud Run 실습 알림`이다.

- 측정항목은 `run.googleapis.com/request_count`이며 `service_name=hello`와 `response_code_class=5xx`만 선택했다. 리비전 이름을 고정하지 않아 이후에도 해당 서비스의 새 버전과 태그로 호출한 테스트 리비전이 포함된다.
- 1분 구간을 초당 발생률(`rate`)로 환산했다. 조건은 값이 0을 초과하고 재테스트 기간은 0초다. 한 구간만 기준을 넘겨도 감지할 수 있지만 지표 수집과 정책 평가에는 시간이 걸린다. [지표 알림의 동작과 지연](https://docs.cloud.google.com/monitoring/alerts/concepts-indepth)
- [Cloud Monitoring](https://console.cloud.google.com/monitoring/alerting)의 알림 목록에서 열린 알림과 종료된 알림을 확인한다. 인시던트가 보이면 이메일까지 도착했는지 별도로 확인한다.

### 이메일 수신 검증과 정리

1. 로컬 서버에 `/alert-test`만 HTTP 500을 반환하는 임시 코드를 추가했다. `main` 트리거의 자동 전환을 피하기 위해 `demo` 폴더를 수동으로 Cloud Build에 제출해 별도 이미지를 생성했다.
2. 테스트 이미지를 `--no-traffic --tag=alert-test`로 배포했다. 태그 URL의 `/alert-test`에 인증된 요청을 한 번 보냈고, 한국 시간 15:57:42에 `hello-00033-ciz`에서 HTTP 500이 기록됐다.
3. 지표에서 1분간 1건이 약 `0.0167건/초`로 나타났고, 16:01에 열린 알림이 이메일로 도착했다. 이 값은 **초당 오류 발생 건수**다.
4. `alert-test` 태그와 로컬 임시 경로를 제거했다. `hello-00033-ciz`는 기본 트래픽 0%, `hello-00031-xiq`는 100%임을 콘솔에서 확인했다.
