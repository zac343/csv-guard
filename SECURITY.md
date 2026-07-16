# Security policy

## Supported version

Security fixes target the current public release and the current `main` branch.

## Report a vulnerability privately

Use GitHub's [private vulnerability-reporting form](https://github.com/zac343/csv-guard/security/advisories/new). Do not open a public issue for a vulnerability before a fix is available.

Include the affected browser or runtime, a minimal reproduction, impact, and any suggested mitigation. Use synthetic data only. Never submit a private CSV, real customer rows, credentials, tokens, personal data, or proprietary data.

## Product boundary

The primary GitHub Pages edition processes CSV content inside the browser and blocks background connections with its content security policy. GitHub project Pages shares the `zac343.github.io` origin with any future project Pages sites on the same account; this is a documented hosting boundary, not a promise of origin isolation.
