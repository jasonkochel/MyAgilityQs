# GitHub Actions CI/CD

## Setup

### 1. Add AWS Credentials to GitHub Secrets

Go to your repository settings → Secrets and variables → Actions, and add:

- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key

### 2. How It Works

**Trigger:** Push to `main` branch

**Smart Deployment Logic:**
1. 🔍 **Detect Changes** - Analyze which packages/files changed
2. 🏗️ **Deploy Infrastructure** - Only if server/infrastructure files changed
3. 🌐 **Deploy Frontend** - Only if client/shared files changed
4. 📋 **Summary** - Show what was deployed

### 3. Change Detection

| Files Changed | Infrastructure Deploy | Frontend Deploy |
|---------------|----------------------|-----------------|
| `shared/` | ✅ (if server exists) | ✅ |
| `server/` | ✅ | ❌ |
| `client/` | ❌ | ✅ |
| `template.yaml` | ✅ | ❌ |
| `samconfig.toml` | ✅ | ❌ |

### 4. Deployment Jobs

**Jobs run in parallel when possible:**
- `detect-changes` → `deploy-infrastructure` + `deploy-frontend` → `deployment-summary`

**Example scenarios:**
- **Update API logic**: Only infrastructure deploys
- **Update UI styling**: Only frontend deploys  
- **Update shared types**: Both deploy (dependencies)
- **Infrastructure config**: Only infrastructure deploys

### 5. Manual Deployment

If you need to deploy manually:

```bash
# Deploy everything
npm run deploy && npm run deploy:frontend

# Deploy just frontend (after building)
npm run deploy:frontend
```

## Features

- 🚀 **Automatic deployment** on push to main
- 🎯 **Smart deploys** - only builds/deploys what changed
- 📦 **Monorepo support** - understands package dependencies
- 🌐 **Full stack** - both infrastructure and frontend
- ⚡ **Fast** - skips unnecessary builds and deployments
- 🔒 **Secure** - uses GitHub secrets for AWS credentials
- 📋 **Clear feedback** - shows exactly what was deployed

## Deployment Examples

### Frontend-only change:
```
📋 Deployment Summary:
🔄 Shared changed: false
🖥️  Server changed: false  
🌐 Client changed: true
🏗️  Infrastructure changed: false

⏭️  Infrastructure deployment: SKIPPED (no changes)
✅ Frontend deployment: SUCCESS
```

### Backend-only change:
```
📋 Deployment Summary:
🔄 Shared changed: false
🖥️  Server changed: true
🌐 Client changed: false
🏗️  Infrastructure changed: false

✅ Infrastructure deployment: SUCCESS
⏭️  Frontend deployment: SKIPPED (no changes)
```

**Efficient and intelligent! 🎯**