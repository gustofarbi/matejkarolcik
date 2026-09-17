---
title: "Infrastructure for two shops"
date: 2026-07-01
weight: 40
summary: "Two e-commerce brands, four environments, one set of Terraform modules. The boring half of backend work, and the half that decides whether the interesting half ships."
stack: ["Terraform", "AWS", "Kubernetes", "Helm", "GitHub Actions"]
showComments: false
showTableOfContents: true
---

## The problem

myposter and JUNIQE are two shops with separate catalogues, separate frontends
and mostly separate services — but the same small group of people behind them.
Each has a production and a staging environment. Every new service needs a
database, a queue, a cache, an IAM role, a bucket, a deployment pipeline and a
way to be looked at when it misbehaves.

Do that by hand four times per service and two things happen: it takes a week to
launch anything, and the four environments quietly stop resembling each other.
The second one is worse, because you find out about it during an incident.

## Constraints

- Staging has to actually predict production. A staging environment that differs
  in interesting ways is a very expensive way of learning nothing.
- Developers should not need to be Terraform authors to ship a service.
- Nothing can require a big-bang migration. These are live shops.

## What I did

**Environment repositories, one per environment.** Each holds a Terraform stack
per service — the renderers, the search service, the backends, the Lambdas, the
gateways. A service's infrastructure lives next to the other services in the same
environment, so what exists there is one directory listing away.

**A shared module library.** Versioned, reusable modules for the things every
service needs:

- Aurora Serverless v2, Postgres and MySQL
- ElastiCache — Redis, Redis Serverless, Valkey Serverless
- RabbitMQ, SQS queues, API Gateway
- IAM roles, including a dedicated Kubernetes application role
- S3 buckets, cost alerts, and a metadata module that makes tagging consistent
  rather than aspirational

Modules are consumed by version, not by branch. Upgrading a database module is a
decision each environment makes on purpose, which is the entire point: production
should be behind staging, deliberately, and for as long as it takes to be sure.

**Shared deployment workflows.** Reusable GitHub Actions pipelines driven by two
files in the repository root listing the Helm values and Terraform var files.
Adding a service means adding a line, not writing a pipeline. The workflow is
maintained once for everyone rather than copy-pasted and left to rot.

## Outcome

A new service reaches staging with a stack directory and a couple of lines of
configuration, on the same primitives as everything else. The four environments
stay comparable because they are made of the same parts, and drift shows up as a
version difference rather than a surprise.

**What it costs.** Shared modules are a coupling. A change to the database module
is a change everyone eventually takes, so the module has to be more careful and
more conservative than any single caller would need to be. Versioning makes that
bearable; it does not make it free.

And distributing modules as versioned archives in object storage is pragmatic
rather than elegant. A proper registry would give better discovery and
provenance. This works, it was cheap, and replacing it has never been the most
valuable thing to do that week — which is the honest reason most infrastructure
looks the way it does.
