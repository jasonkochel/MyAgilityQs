# GitHub Actions CI/CD

## Setup

### 1. Add AWS Credentials to GitHub Secrets

Go to your repository settings → Secrets and variables → Actions, and add:

- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key

### 2. How It Works

**Trigger:** Push to `main` branch

**What happens:**
1. ✅ **Build** - Shared, client, and server packages
2. ✅ **Deploy Infrastructure** - SAM deploy (Lambda, API Gateway, DynamoDB, etc.)
3. ✅ **Deploy Frontend** - Upload React app to S3 + invalidate CloudFront
4. ✅ **Live** - Changes are live at https://myagilityqs.com

### 3. Workflow File

`.github/workflows/ci.yml` handles everything automatically.

### 4. Manual Deployment

If you need to deploy manually:

```bash
# Deploy everything
npm run deploy && npm run deploy:frontend

# Deploy just frontend (after building)
npm run deploy:frontend
```

## Features

- 🚀 **Automatic deployment** on push to main
- 📦 **Monorepo support** - builds all workspaces in correct order
- 🌐 **Full stack** - both infrastructure and frontend
- ⚡ **Fast** - uses npm cache and only deploys changes
- 🔒 **Secure** - uses GitHub secrets for AWS credentials

## Deployment Flow

```
Push to main → Build packages → Deploy AWS infrastructure → Upload frontend → Live!
```

Simple and automated! 🎉