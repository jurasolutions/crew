---
name: infra-review
description: Infrastructure review for a change: every build, deploy, config, secret, IaC and CI touchpoint, the deploy plan, observability and rollback.
user-invocable: false
---

# Infra review

Write `reviews/infra.md` with these sections.

## Touchpoints

| Touchpoint | Change | Environments | Owner | Status |
|---|---|---|---|---|

Cover: build scripts and toolchain versions, CI pipelines, hosting and deploy config, environment variables, secrets, IaC, DNS and domains, scheduled jobs, queues, storage buckets, third-party services and their quotas.

## Secrets

For each secret: its name, where it must live per environment (hosting env vars, CI secret store, gitignored `.env`), who creates it, and the `wizard` script path if a human must create it. Secret values never appear here.

## Deploy plan

1. Pre-deploy: migrations (forward and down), config to set, feature flags.
2. Deploy: the exact sequence and who triggers it.
3. Smoke check: the URL or command and its expected result.
4. Watch: logs, errors, metrics and the threshold that means roll back.
5. Rollback: the steps, and what a rollback doesn't undo.

## Risks

Cold starts, rate limits, region and latency, cost, vendor limits, and drift between environments, each with a mitigation.

**Done when** every touchpoint has an owner and status, and the plan has a smoke check and a rollback.
