terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.28.0"
    }
  }
}

variable "notification_email" {
  description = "기존 Cloud Monitoring 이메일 알림 채널의 수신 주소."
  type        = string
}

variable "local_operator_email" {
  description = "로컬 인증 호출 실습에서 빌드 서비스 계정을 가장하는 기존 사용자 주소."
  type        = string
}

locals {
  project_id         = "mineral-brand-515105-e3"
  region             = "asia-northeast3"
  service_name       = "hello"
  repository_id      = "backend-images"
  runtime_account_id = "backend-infra-testing"
  build_account      = "1056202155531-compute@developer.gserviceaccount.com"

  min_instance_count = 0
  max_instance_count = 2

  project_path         = "projects/${local.project_id}"
  run_service_path     = "${local.project_path}/locations/${local.region}/services/${local.service_name}"
  runtime_account_path = "${local.project_path}/serviceAccounts/${local.runtime_account_id}@${local.project_id}.iam.gserviceaccount.com"
  build_account_path   = "${local.project_path}/serviceAccounts/${local.build_account}"
  build_member         = "serviceAccount:${local.build_account}"
  local_operator       = "user:${var.local_operator_email}"
}

provider "google" {
  project = local.project_id
  region  = local.region
}

resource "google_artifact_registry_repository" "backend_images" {
  location               = local.region
  repository_id          = local.repository_id
  format                 = "DOCKER"
  mode                   = "STANDARD_REPOSITORY"
  cleanup_policy_dry_run = true

  docker_config {
    immutable_tags = false
  }

  vulnerability_scanning_config {
    enablement_config = "DISABLED"
  }
}

resource "google_service_account" "runtime" {
  account_id   = local.runtime_account_id
  display_name = "backend-infra-testing"
  description  = "bakcend-infra-testing전용계정"
}

resource "google_cloud_run_v2_service" "hello" {
  name                = local.service_name
  location            = local.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  launch_stage        = "GA"
  deletion_protection = true

  scaling {
    min_instance_count = local.min_instance_count
    max_instance_count = local.max_instance_count
  }

  template {
    service_account                  = google_service_account.runtime.email
    timeout                          = "300s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = local.min_instance_count
      max_instance_count = local.max_instance_count
    }

    containers {
      name  = "hello-1"
      image = "${local.region}-docker.pkg.dev/${local.project_id}/${google_artifact_registry_repository.backend_images.repository_id}/backend-infra-testing:0e175c2"

      env {
        name  = "APP_ENV"
        value = "learning"
      }

      ports {
        name           = "http1"
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      startup_probe {
        timeout_seconds   = 240
        period_seconds    = 240
        failure_threshold = 1

        tcp_socket {
          port = 8080
        }
      }
    }
  }

  # Cloud Build deploys images, names revisions and promotes traffic after smoke tests.
  lifecycle {
    ignore_changes = [client, client_version, template[0].revision, template[0].containers[0].image, traffic]
  }
}

resource "google_cloud_run_v2_service_iam_member" "build_invoker" {
  location = google_cloud_run_v2_service.hello.location
  name     = google_cloud_run_v2_service.hello.name
  role     = "roles/run.invoker"
  member   = local.build_member
}

resource "google_service_account_iam_member" "build_openid_token_creator" {
  service_account_id = local.build_account_path
  role               = "roles/iam.serviceAccountOpenIdTokenCreator"
  member             = local.build_member
}

resource "google_service_account_iam_member" "local_operator_token_creator" {
  service_account_id = local.build_account_path
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.local_operator
}

resource "google_service_account_iam_member" "build_runtime_user" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = local.build_member
}

resource "google_cloudbuild_trigger" "main" {
  location        = "global"
  name            = "LEEHEEWON"
  description     = "backend-infra-testing-main"
  filename        = "cloudbuild.yaml"
  service_account = local.build_account_path

  github {
    owner = "killerkoje"
    name  = "backend_infra_testing"

    push {
      branch = "^main$"
    }
  }
}

resource "google_monitoring_notification_channel" "email" {
  display_name = "Cloud Run 실습 알림"
  type         = "email"
  enabled      = true

  labels = {
    email_address = var.notification_email
  }
}

resource "google_monitoring_alert_policy" "hello_5xx" {
  display_name          = "요청 수"
  combiner              = "OR"
  enabled               = true
  notification_channels = [google_monitoring_notification_channel.email.name]

  documentation {
    subject = "hello HTTP 5xx 감지"
  }

  # The console created a title-only document. The provider defaults its MIME type.
  lifecycle {
    ignore_changes = [documentation[0].mime_type]
  }

  alert_strategy {
    notification_prompts = ["OPENED"]
  }

  conditions {
    display_name = "Cloud Run Revision - Request Count"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${local.service_name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["metric.label.response_code_class"]
      }

      trigger {
        count = 1
      }
    }
  }
}

# Adopt the existing lab resources in this project.
import {
  to = google_artifact_registry_repository.backend_images
  id = "${local.project_path}/locations/${local.region}/repositories/${local.repository_id}"
}

import {
  to = google_service_account.runtime
  id = local.runtime_account_path
}

import {
  to = google_cloud_run_v2_service.hello
  id = local.run_service_path
}

import {
  to = google_cloud_run_v2_service_iam_member.build_invoker
  id = "${local.run_service_path} roles/run.invoker ${local.build_member}"
}

import {
  to = google_service_account_iam_member.build_openid_token_creator
  id = "${local.build_account_path} roles/iam.serviceAccountOpenIdTokenCreator ${local.build_member}"
}

import {
  to = google_service_account_iam_member.local_operator_token_creator
  id = "${local.build_account_path} roles/iam.serviceAccountTokenCreator ${local.local_operator}"
}

import {
  to = google_service_account_iam_member.build_runtime_user
  id = "${local.runtime_account_path} roles/iam.serviceAccountUser ${local.build_member}"
}

import {
  to = google_cloudbuild_trigger.main
  id = "${local.project_path}/locations/global/triggers/cbc0ec73-209e-4dd9-a2d4-2cd5a78a24e7"
}

import {
  to = google_monitoring_notification_channel.email
  id = "${local.project_path}/notificationChannels/13582268504729240210"
}

import {
  to = google_monitoring_alert_policy.hello_5xx
  id = "${local.project_path}/alertPolicies/7608338947207154480"
}
