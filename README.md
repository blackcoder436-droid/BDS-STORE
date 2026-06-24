# BDS STORE - Freemium VPN Project

## 🛡️ System Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│   Flutter App        │     │   Backend API        │     │   VPN Server         │
│   (Hiddify Fork)     │────▶│   (Node.js Express)  │────▶│   (3x-ui Panel)      │
│                      │     │                      │     │   (Xray Core)        │
│  • One-Tap Connect   │     │  • User Auth (JWT)   │     │                      │
│  • AdMob Rewarded    │     │  • AdMob SSV         │     │  • VLESS / VMess     │
│  • Countdown Timer   │     │  • Time Management   │     │  • Trojan            │
│  • Get Free 2 Hours  │     │  • 3x-ui API Bridge  │     │  • Shadowsocks       │
└──────────────────────┘     └──────────────────────┘     └──────────────────────┘
                                      │
                              ┌───────┴───────┐
                              │  PostgreSQL   │
                              │  Database     │
                              └───────────────┘
```

## 📁 Project Structure

```
BDS STORE/
├── backend/                    # Node.js Express API Server
│   ├── src/
│   │   ├── server.js          # Entry point
│   │   ├── config/            # Database & app configuration
│   │   ├── models/            # Sequelize models (User, Session)
│   │   ├── middleware/        # Auth, rate limiter, error handler
│   │   ├── routes/            # API endpoints (auth, ads, vpn)
│   │   ├── services/          # Business logic (xray, admob, time)
│   │   └── utils/             # Logger, helpers
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── flutter_integration/        # Flutter code for Hiddify-Next fork
│   └── lib/
│       ├── services/          # AdMob, API, time balance
│       ├── widgets/           # UI components
│       ├── models/            # Data models
│       └── config/            # App configuration
│
├── docker-compose.yml          # Docker setup (PostgreSQL + Backend + Redis)
└── docs/                       # Documentation
    └── SETUP_GUIDE.md
```

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ 
- [PostgreSQL](https://www.postgresql.org/) v14+
- [Docker](https://www.docker.com/) (optional, recommended)
- [Flutter SDK](https://flutter.dev/) v3.x
- [Git](https://git-scm.com/)

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/bds-store-vpn.git
cd bds-store-vpn

# 2. Create .env file from template
cp backend/.env.example backend/.env
# Edit .env with your actual values

# 3. Start all services
docker-compose up -d

# 4. Check health
curl http://localhost:3000/api/v1/health
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Setup PostgreSQL
# Create database: bds_store_vpn
# Create user: bds_admin

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Sync database
npm run db:sync

# 5. Start development server
npm run dev
```

## 🔑 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | ❌ | Register new user |
| POST | `/api/v1/auth/login` | ❌ | Login |
| GET | `/api/v1/auth/profile` | ✅ | Get user profile |
| GET | `/api/v1/ads/verify` | ❌ | AdMob SSV callback |
| POST | `/api/v1/ads/reward-status` | ✅ | Check reward status |
| GET | `/api/v1/vpn/config` | ✅ | Get VPN config |
| POST | `/api/v1/vpn/connect` | ✅ | Log VPN connect |
| POST | `/api/v1/vpn/disconnect` | ✅ | Log VPN disconnect |
| GET | `/api/v1/vpn/status` | ✅ | Get VPN status |
| GET | `/api/v1/health` | ❌ | Health check |

## 📱 Flutter Integration

The `flutter_integration/` directory contains standalone Dart files to integrate into the Hiddify-Next fork:

1. Copy files from `flutter_integration/lib/` to your Hiddify fork's `lib/` directory
2. Add required dependencies to `pubspec.yaml`:
   ```yaml
   dependencies:
     google_mobile_ads: ^5.0.0
     http: ^1.2.0
     provider: ^6.1.0
     shared_preferences: ^2.2.0
   ```
3. Follow the setup guide in `docs/SETUP_GUIDE.md`

## 🔒 Security Notes

- **GPL-3.0 License**: Hiddify-Next is GPL-3.0. Modified app source must be open-sourced.
- **Sensitive logic** (AdMob SSV, 3x-ui API keys) stays in the Backend (not in the Flutter app).
- **Never** commit `.env` files to Git.
- Use **HTTPS** for all API communications in production.

## 📄 License

This project's Backend API is proprietary. The Flutter app fork follows GPL-3.0.
