# MyAgilityQs

> A modern web application for tracking AKC Canine Agility competition results

MyAgilityQs helps agility competitors track their dogs' qualifying runs (Qs), monitor title progress, and celebrate achievements like earning a Master Agility Champion (MACH) title.

## ✨ Features

- 🐕 **Multi-dog tracking** - Manage multiple dogs with individual progress
- 🏆 **Automatic level progression** - Dogs advance levels after earning 3 qualifying runs  
- 📱 **Mobile-optimized** - Quick run entry designed for use at competitions
- 🔐 **Secure authentication** - Login with email/password or Google OAuth
- 📊 **Progress analytics** - Track Double Qs (QQs) and MACH progress
- ⚡ **Real-time updates** - Immediate cache updates and trophy notifications

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- npm
- Docker (for local backend development)

### Development Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd MyAgilityQs
npm install

# Start the full application
npm run dev
```

This starts:
- **Frontend**: http://localhost:5174 (React app)
- **Backend**: http://localhost:3001 (AWS Lambda local)

### Production URLs
- **API**: https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/
- **Health Check**: https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/health

## 🏃‍♀️ Using the App

1. **Sign up** with email/password or Google
2. **Add your dogs** with their competition classes and levels
3. **Enter runs** quickly on mobile at competitions
4. **Track progress** toward titles and MACH achievements

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
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

- [Development Guide](docs/development.md) - Architecture, setup, and development workflow
- [Deployment Guide](docs/deployment.md) - AWS deployment and production setup  
- [OAuth Setup](docs/oauth-setup.md) - Google OAuth configuration
- [CLAUDE.md](CLAUDE.md) - LLM context and development reference

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome! Please open an issue to discuss any changes.

## 📝 License

MIT License - see LICENSE file for details.

---

**Note**: This application is designed for personal use by AKC agility competitors. All AKC rules and terminology are used in accordance with official AKC guidelines.