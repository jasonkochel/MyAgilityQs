# MyAgilityQs

> A modern web application for tracking AKC Canine Agility competition results

MyAgilityQs helps agility competitors track their dogs' qualifying runs (Qs), monitor title progress, and celebrate achievements like earning a Master Agility Champion (MACH) title.

## ✨ Features

- 🐕 **Multi-dog tracking** - Manage multiple dogs with individual progress
- 🏆 **Automatic level progression** - Dogs advance levels after earning 3 qualifying runs  
- 📱 **Mobile-optimized** - Quick run entry designed for use at competitions
- 🔐 **Secure authentication** - Login with email/password or Google OAuth
- 📊 **Title progress tracking** - Visual progress toward next level and MACH titles
- 🎯 **MACH point entry** - Track Masters Standard/Jumpers points toward MACH (750 points + 20 Double Qs)
- ⚡ **Real-time updates** - Immediate cache updates and trophy notifications

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- npm
- Docker (for local backend development)

### Development Setup

```bash
git clone <repository-url>
cd MyAgilityQs
npm install
npm run build           # builds shared, client, server in order

# Frontend only, talking to the live prod backend (default):
npm run dev:client      # http://localhost:5174

# Or full local stack (Vite + SAM Lambda + real Cognito + prod DynamoDB):
npm run dev             # http://localhost:5174 + http://localhost:3001
```

For the local Lambda mode, see [docs/development.md](docs/development.md) for
how to point the client at the local backend, isolate the test database, and
use the `tools/progtest.mjs` integration-testing CLI.

### Production URLs
- **App**: https://myagilityqs.com
- **API**: https://vep645bkmqblgemzy72psyrsju0mjgma.lambda-url.us-east-1.on.aws/
- **Health Check**: https://vep645bkmqblgemzy72psyrsju0mjgma.lambda-url.us-east-1.on.aws/health

## 🏃‍♀️ Using the App

1. **Sign up** with email/password or Google
2. **Add your dogs** with their competition classes and levels
3. **Enter runs** quickly on mobile at competitions (including MACH points for Masters)
4. **Track progress** on the Title Progress page - see current levels and advancement progress
5. **Monitor MACH progress** for dogs competing in Masters Standard and Jumpers

## 🛠 Tech Stack

### Frontend
- **React 19** with TypeScript
- **Mantine** UI components
- **TanStack Query** for data fetching
- **Vite** for development and building

### Backend  
- **AWS Lambda** with TypeScript
- **DynamoDB** single-table design
- **AWS Cognito** for authentication
- **Google OAuth** integration

### Development
- **npm workspaces** monorepo
- **SAM CLI** for local Lambda development
- **esbuild** for fast compilation

## 📖 Documentation

- [Development Guide](docs/development.md) — architecture, local setup, SAM local backend, test database options, integration testing
- [Deployment Guide](docs/deployment.md) — AWS resources, deployment via GitHub Actions, manual deploy, monitoring
- [OAuth Setup](docs/oauth-setup.md) — one-time Google OAuth + Cognito configuration
- [S3 Photo Upload](docs/AWS_S3_SETUP.md) — historical reference; CORS is automated by `template.yaml`
- [CLAUDE.md](CLAUDE.md) — LLM context for AI-assisted development

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome! Please open an issue to discuss any changes.

## 📝 License

MIT License - see LICENSE file for details.

---

**Note**: This application is designed for personal use by AKC agility competitors. All AKC rules and terminology are used in accordance with official AKC guidelines.