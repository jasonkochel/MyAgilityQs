# Cognito Email Configuration

The user pool `us-east-1_808uxrU8E` ("MyAgilityQs-Users") was created outside
CloudFormation and is not managed by `template.yaml`. The pool's email-related
configuration (SES sender, branded HTML template, verification settings) is
applied via AWS CLI and **persists in the pool itself** across deploys.

This document is the canonical reference for what's set and how to re-apply
it if the pool is ever recreated.

## Current state (as of 2026-05-05)

- **Sender**: `MyAgilityQs <noreply@myagilityqs.com>` via SES (verified domain
  in `us-east-1`, account in production access — not sandbox)
- **SES identity ARN**: `arn:aws:ses:us-east-1:016551291133:identity/myagilityqs.com`
- **Reply-to**: `noreply@myagilityqs.com`
- **Email template**: branded HTML, used for both signup verification and
  forgot-password (Cognito reuses the same `VerificationMessageTemplate` for
  both flows by default)
- **Auto-verified attribute**: `email`
- **Verification mode**: `CONFIRM_WITH_CODE`

## Why this isn't in template.yaml

The user pool predates the SAM stack. Importing it into CloudFormation now
would require non-trivial drift reconciliation (callback URLs, identity
providers, App Clients, custom domain). Out-of-band config is the pragmatic
trade-off until/unless the pool is rebuilt.

## Re-applying the configuration

Both commands together reconstitute the email behavior. **The
`update-user-pool` API is full-replace** for any field passed — read the
current values first if you're modifying a single setting, or always pass
the full object as below.

### 1. Verification template (subject + HTML body)

The template HTML is in `cognito-verification-template.html` next to this file.
The CLI takes it as a JSON file:

```bash
# Build the JSON payload from the HTML template (PowerShell or bash)
node -e '
const fs = require("fs");
const html = fs.readFileSync("infrastructure/cognito-verification-template.html", "utf8");
const json = {
  EmailSubject: "Your MyAgilityQs verification code",
  EmailMessage: html,
  DefaultEmailOption: "CONFIRM_WITH_CODE"
};
fs.writeFileSync("/tmp/cognito-msg.json", JSON.stringify(json));
'

aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_808uxrU8E \
  --verification-message-template file:///tmp/cognito-msg.json \
  --auto-verified-attributes email
```

### 2. Email sending account (SES sender + branded From)

```bash
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_808uxrU8E \
  --auto-verified-attributes email \
  --email-configuration '{
    "EmailSendingAccount": "DEVELOPER",
    "From": "MyAgilityQs <noreply@myagilityqs.com>",
    "SourceArn": "arn:aws:ses:us-east-1:016551291133:identity/myagilityqs.com",
    "ReplyToEmailAddress": "noreply@myagilityqs.com"
  }'
```

### Combined (apply everything in one call)

If you're standing up from scratch, do both at once:

```bash
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_808uxrU8E \
  --verification-message-template file:///tmp/cognito-msg.json \
  --auto-verified-attributes email \
  --email-configuration '{
    "EmailSendingAccount": "DEVELOPER",
    "From": "MyAgilityQs <noreply@myagilityqs.com>",
    "SourceArn": "arn:aws:ses:us-east-1:016551291133:identity/myagilityqs.com",
    "ReplyToEmailAddress": "noreply@myagilityqs.com"
  }'
```

## Verification

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_808uxrU8E \
  --query 'UserPool.{Email:EmailConfiguration,Verification:VerificationMessageTemplate}' \
  --output json
```

Expected output includes `From: "MyAgilityQs <noreply@myagilityqs.com>"`,
`EmailSendingAccount: "DEVELOPER"`, and the branded HTML body.

## Other out-of-band pool config

In addition to the email setup, the pool has these settings managed
out-of-band (not in `template.yaml`, but reasonably stable):

- **App Clients** (2): `MyAgilityQs-Client` (`31rckg6cckn32b8fsil5blhh4t`),
  `MyAgilityQs-AppClient` (`7qaajum3pc6ehvkbhidjvmrjmq`). Server uses the
  AppClient via `COGNITO_CLIENT_ID` env var.
- **App Client allowed callback URLs**: `http://localhost:5174/auth/callback`,
  `https://myagilityqs.com/auth/callback`, `https://www.myagilityqs.com/auth/callback`
- **App Client explicit auth flows**: `ALLOW_ADMIN_USER_PASSWORD_AUTH`,
  `ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_USER_SRP_AUTH`
- **Custom domain**: `auth.myagilityqs.com` (Cognito hosted UI; ACM cert
  in `us-east-1`)
- **Federated IdPs**: COGNITO + Google. Google client ID/secret stored in the
  pool's identity provider config (not version-controlled).

**Gotcha:** `update-user-pool-client` is a full-replace for every field.
Always pass `--explicit-auth-flows`, `--callback-urls`,
`--supported-identity-providers`, etc. when modifying any one of them, or
the others get nulled out. There's a comment in this repo's history about
this regression — don't repeat it.

## Future work

- `CustomMessage` Lambda trigger so signup verification and forgot-password
  emails have distinct subject lines and copy. Currently both reuse the same
  generic template ("Your MyAgilityQs verification code" / "Use this code
  to verify your account"). See the productization plan in `~/.claude/`
  memory for design notes.
