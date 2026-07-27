# Secrets Management and Key Rotation

This project separates configuration into:

- public runtime variables (`NEXT_PUBLIC_*`) that may be sent to the browser bundle
- server-only secrets that must stay in your hosting provider's secret store

## 1. Secret Classification

Public-only variables (safe for browser/runtime config):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STELLAR_NETWORK`
- `NEXT_PUBLIC_CREDENTIAL_NFT_CONTRACT`
- `NEXT_PUBLIC_CREDENTIAL_REGISTRY_CONTRACT`
- `NEXT_PUBLIC_PINATA_GATEWAY`
- `NEXT_PUBLIC_ENABLE_DEBUG_LOGS`

Server-only secrets (never in `NEXT_PUBLIC_*`):

- `SUPABASE_SERVICE_ROLE_KEY`
- `PINATA_JWT`
- `VERIFICATION_LOG_HASH_SECRET`
- Stellar deployer/admin secret seeds (for CLI/deployment)

## 2. Network Profiles (Single Boot Switch)

Use one switch at boot time:

- `NEXT_PUBLIC_STELLAR_NETWORK=testnet`
- `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`
- `NEXT_PUBLIC_STELLAR_NETWORK=custom`

For `testnet` and `mainnet`, RPC/Horizon/passphrase/explorer are profile-locked by [frontend/src/lib/runtimeConfig.ts](frontend/src/lib/runtimeConfig.ts).

Use `custom` only when you intentionally provide all custom network fields:

- `NEXT_PUBLIC_NETWORK_PASSPHRASE`
- `NEXT_PUBLIC_HORIZON_URL`
- `NEXT_PUBLIC_SOROBAN_RPC_URL`
- `NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL`

## 3. Hosting Setup (Required)

Store server secrets only in your host secret manager (for example Vercel/Netlify/Render project secrets):

- production environment: production secrets only
- preview/test environment: testnet secrets only

Never copy production secrets into preview/test environments.

## 4. Rotation Procedure

Rotate immediately if any key was committed, pasted in chat/issues, shared in screenshots, or logged.

1. Inventory and invalidate
- identify affected key(s) and where they were exposed
- disable/revoke old key(s) in provider dashboard

2. Re-issue new credentials
- Supabase: create a new service-role key and disable old one
- Pinata: revoke old JWT key and issue a new restricted JWT
- Verification log secret: generate a new 32+ byte random secret
- Stellar deployer/admin keys: generate new keypairs and transfer ownership/permissions if needed

3. Update host secret store
- write new values to protected environment variables
- keep production and testnet values separate

4. Redeploy and verify
- redeploy app/services using rotated secrets
- verify admin APIs, IPFS pinning, and verification audit hashing all work

5. Post-rotation checks
- run local and CI secret scans (`gitleaks`)
- inspect build/runtime logs for authentication failures
- document incident and timestamp in internal runbook

## 5. Local Developer Workflow

Local development can use `frontend/.env.local` for convenience, but do not commit it.

Recommended pre-commit setup:

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```

This repository ships:

- `.gitleaks.toml` policy
- `.pre-commit-config.yaml` staged gitleaks hook
- CI gitleaks job in `.github/workflows/ci.yml`
- scheduled/PR secret scan workflow in `.github/workflows/secret-scan.yml`
