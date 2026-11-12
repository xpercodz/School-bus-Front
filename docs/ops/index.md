# Operations runbooks

Both describe the state **after** the Blaze upgrade. `school-bus-a4f23` is on Spark
today, so their Firestore backup and Cloud Run commands are refused until billing is on.

- [Firestore backups](firestore-backups.md) — schedules, what a restore writes (a
  new database, without TTL policies), the recovery procedure, PITR, and costs.
- [Cloud Run deploy](cloud-run-deploy.md) — the deploy command, min/max instances,
  measuring `TRUSTED_PROXY_HOPS`, the open `*.run.app` bypass, cost guardrails.
- [Production readiness decisions](production-readiness-decisions.md) — the verdict
  on a nine-item readiness brief: accepted, rejected or deferred, with the evidence,
  and the residual risks we accepted on purpose.

Deploy commands that already exist (`npm run deploy`, `deploy:rules`,
`deploy:indexes`) and the same-origin Hosting rewrites are in `APP_OVERVIEW.md` §7.
The API service itself lives in the sibling repo `School-bus-API`.
