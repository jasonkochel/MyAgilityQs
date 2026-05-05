# Deployment Guide

Deployment is handled automatically by GitHub Actions on push to `main` (see
`.github/workflows/ci.yml`). This document covers the AWS resources that get
deployed, environment configuration, and how to deploy manually if you need to.

## Production Environment

- **App**: https://myagilityqs.com
- **API**: https://vep645bkmqblgemzy72psyrsju0mjgma.lambda-url.us-east-1.on.aws/
- **Health check**: https://vep645bkmqblgemzy72psyrsju0mjgma.lambda-url.us-east-1.on.aws/health
- **Region**: us-east-1
- **CloudFormation stack**: `my-agility-qs`

## AWS Resources

All resources are defined in `template.yaml` at the repo root and deployed via
SAM. See the template for the canonical definition; this list is the high-level
inventory.

| Resource | Identifier / Notes |
|---|---|
| Lambda Function | `ApiFunction` — Node.js 24.x, 30s timeout, 128MB. Single function handles all routes via Middy router. |
| Lambda Function URL | The function is exposed directly via a Function URL (auth: NONE). Delivers API Gateway v2 event shape. **Production does not use API Gateway.** |
| DynamoDB table | `MyAgilityQs` (prod) / `MyAgilityQs-Dev` (non-prod). Single-table design with `GSI1`. PAY_PER_REQUEST billing. PITR enabled. |
| Cognito User Pool | `us-east-1_808uxrU8E` ("MyAgilityQs-Users"). Email + Google OAuth, `CONFIRM_WITH_CODE` email verification. |
| Cognito App Clients | `MyAgilityQs-Client` (`31rckg6cckn32b8fsil5blhh4t`), `MyAgilityQs-AppClient` (`7qaajum3pc6ehvkbhidjvmrjmq`). Server uses the AppClient. |
| Cognito Hosted UI Domain | `auth.myagilityqs.com` (custom domain) |
| S3 bucket (frontend + photos) | `myagilityqs-frontend` (prod) / `-dev` for non-prod. Hosts SPA + dog photos under `dog-photos/{dogId}/`. CORS configured by template. |
| CloudFront | Distribution `EFPF6DBPT9OEI`, served from `myagilityqs.com` + `www.myagilityqs.com`. SPA fallback to `index.html` on 403/404. |
| Route 53 | Hosted zone for `myagilityqs.com`, A records for apex + www. |
| ACM cert | Auto-created for `myagilityqs.com` + SAN, DNS-validated against the hosted zone. |

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push to `main`:

1. **Detect changes** — separate jobs run only if `shared/`, `server/`, `client/`, or `template.yaml` changed.
2. **Deploy infrastructure** — runs `sam deploy --no-confirm-changeset --no-fail-on-empty-changeset` from the repo root, using `samconfig.toml`. Parameter override: `Environment=production`.
3. **Deploy frontend** — `npm run deploy:frontend`: builds the client, syncs `client/dist/` to S3, then invalidates CloudFront.

Required secrets in the GitHub repo: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

## Manual Deployment

If CI is wedged or you need to deploy from a feature branch:

```bash
# Prereqs
aws sts get-caller-identity   # creds configured
sam --version                 # SAM CLI installed
docker ps                     # Docker for local SAM builds (not strictly needed for deploy)

# Build then deploy
npm run build
sam deploy --no-confirm-changeset

# Then push the frontend to S3 + invalidate CloudFront
npm run deploy:frontend
```

`samconfig.toml` (at repo root) holds the deploy parameters:

```toml
stack_name = "my-agility-qs"
region = "us-east-1"
parameter_overrides = "Environment=\"production\""
template_file = "template.yaml"
```

## Environment Variables

The Lambda's env vars are defined in `template.yaml` under `ApiFunction.Properties.Environment.Variables`. Most are CloudFormation refs that resolve at deploy time:

| Variable | Source |
|---|---|
| `DYNAMODB_TABLE_NAME` | `!Ref DynamoTable` (resolves to `MyAgilityQs` or `MyAgilityQs-Dev`) |
| `ENVIRONMENT` | `!Ref Environment` parameter |
| `FRONTEND_URL` | `https://myagilityqs.com` (prod) or the `CorsOrigin` parameter (dev) |
| `SENTRY_DSN`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`, `COGNITO_REGION` | Hardcoded in template |

The client's build-time env vars come from `client/.env` (committed) — primarily `VITE_API_URL`. Source maps for Sentry use `SENTRY_AUTH_TOKEN` (CI secret).

## Monitoring

**CloudWatch Logs**:
- `/aws/lambda/my-agility-qs-ApiFunction-<id>` — all server invocations
- View recent errors: `aws logs filter-log-events --log-group-name /aws/lambda/<function> --start-time $(date -d '1 hour ago' +%s)000 --filter-pattern "ERROR"`

**Sentry**: server + client errors stream to the project at `o4509555260981248.ingest.us.sentry.io`. The server now filters out 4xx as expected client errors (see `server/src/middleware/sentryContext.ts`).

**DynamoDB**: PITR is on (35-day window). On-demand backups via `aws dynamodb create-backup` if needed before risky changes.

## Cognito Configuration

The user pool is configured for self-service signup with email verification:

- **`AutoVerifiedAttributes`**: `["email"]`
- **`VerificationMessageTemplate.DefaultEmailOption`**: `CONFIRM_WITH_CODE`
- **`EmailSendingAccount`**: `DEVELOPER` (sends via SES from `noreply@myagilityqs.com`)
- **`PasswordPolicy`**: 8+ chars, uppercase, lowercase, number (no symbols required)

Both App Clients support `ALLOW_USER_PASSWORD_AUTH` and have no client secret (public clients suitable for the React app).

Google OAuth is wired up via the Hosted UI domain `auth.myagilityqs.com`. See [oauth-setup.md](oauth-setup.md) for the one-time setup.

### Out-of-band pool configuration

The user pool predates the SAM stack — it was created outside CloudFormation
and is not managed by `template.yaml`. Email sender (SES + branded From),
verification template HTML, App Client callback URLs, and explicit auth flows
are all set via `aws cognito-idp` CLI commands and persist in the pool itself.

The canonical reference (current state, re-apply commands, full template HTML)
is in [`infrastructure/cognito-email-config.md`](../infrastructure/cognito-email-config.md).
The branded HTML template body lives at `infrastructure/cognito-verification-template.html`.

**Gotcha:** `update-user-pool-client` is a full-replace API. Always pass
`--explicit-auth-flows`, `--callback-urls`, `--supported-identity-providers`,
etc. when modifying any single field, or the others get nulled out.

## Cost (current scale)

- **Lambda**: ~$1-5/month
- **DynamoDB**: ~$2-10/month (PAY_PER_REQUEST, low volume)
- **Cognito**: free tier (well under 50k MAU)
- **S3 + CloudFront**: ~$1-2/month
- **Route 53**: $0.50/month per hosted zone
- **ACM**: free

Total: ~$5-20/month at single-user scale.

## Rollback

**Server**: redeploy the previous good commit. CloudFormation handles in-place updates; there's no Lambda alias / versioning configured, so rollback = redeploy old code.

**Database**: PITR allows restore to any point in the last 35 days via `aws dynamodb restore-table-to-point-in-time`. This creates a *new* table — you'd need to swap names or update `DYNAMODB_TABLE_NAME`.

**Frontend**: `git revert` + push triggers CI to redeploy the older S3 contents and invalidate CloudFront.

## Troubleshooting

**Lambda errors**: tail CloudWatch logs for the function. Sentry should also surface server errors.

**Frontend not updating after deploy**: CloudFront invalidation can take 5-15 minutes. Check the distribution's invalidation status: `aws cloudfront list-invalidations --distribution-id EFPF6DBPT9OEI`.

**Cognito auth failing**: verify the App Client ID matches what `template.yaml` injects into `COGNITO_CLIENT_ID`. Check the user pool exists and the user is `CONFIRMED` (not `UNCONFIRMED`).

**S3 photo upload CORS errors**: CORS is configured by `template.yaml` (`FrontendBucket.CorsConfiguration`). If you've manually edited the bucket's CORS in the console, re-deploy via SAM to reapply the template's config.

**Stack stuck**: `aws cloudformation describe-stack-events --stack-name my-agility-qs --max-items 30` to see the latest events. Common cause: a resource (e.g. CloudFront distribution) that takes >15 min and the deploy times out — re-running often resolves.
