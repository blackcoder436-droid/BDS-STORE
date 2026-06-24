# BDS STORE VPN - Complete Setup Guide

## 📋 Table of Contents
1. [VPS Server & 3x-ui Panel Setup](#1-vps-server--3x-ui-panel-setup)
2. [Backend API Server Setup](#2-backend-api-server-setup)
3. [Google AdMob Setup](#3-google-admob-setup)
4. [Flutter App (Hiddify-Next Fork) Setup](#4-flutter-app-hiddify-next-fork-setup)
5. [Connecting Everything Together](#5-connecting-everything-together)
6. [Production Deployment](#6-production-deployment)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. VPS Server & 3x-ui Panel Setup

### 1.1 VPS ငှားခြင်း

Recommended VPS Providers:
- **Hetzner** (€3.79/month) - ⭐ Best value
- **DigitalOcean** ($6/month)
- **Vultr** ($6/month)
- **Contabo** ($5.99/month)

Minimum specs:
- 1 vCPU
- 1 GB RAM
- 20 GB SSD
- Ubuntu 22.04 LTS

### 1.2 3x-ui Panel Install

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install 3x-ui (one-line install)
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)

# Follow the prompts:
# - Set username (e.g., admin)
# - Set password (strong password)
# - Set panel port (e.g., 54321)
# - Set web base path (e.g., /dashboard)
```

### 1.3 3x-ui Panel Configuration

1. Access panel: `http://YOUR_VPS_IP:54321/dashboard`
2. Login with credentials you set
3. Go to **Panel Settings** → Enable **API** (important!)
4. Create an **Inbound**:
   - Protocol: VLESS (recommended) or VMess
   - Port: 443
   - Security: TLS or Reality
   - Network: TCP or WebSocket
5. Note down the inbound ID - you'll need it for the Backend config

### 1.4 SSL Certificate (Optional but Recommended)

```bash
# Install certbot
apt install certbot -y

# Get certificate for your domain
certbot certonly --standalone -d vpn.yourdomain.com

# Certificate will be at:
# /etc/letsencrypt/live/vpn.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/vpn.yourdomain.com/privkey.pem
```

---

## 2. Backend API Server Setup

### 2.1 Local Development

```bash
# Navigate to backend directory
cd "BDS STORE/backend"

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env file with your actual values
# Use any text editor (VS Code, Notepad++, etc.)
```

### 2.2 Environment Variables (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bds_store_vpn
DB_USER=bds_admin
DB_PASSWORD=your_strong_password_here

# JWT Authentication
JWT_SECRET=generate_a_64_character_random_string_here
JWT_EXPIRES_IN=30d

# AdMob
ADMOB_REWARD_DURATION_HOURS=2
GOOGLE_ADMOB_KEY_SERVER_URL=https://www.gstatic.com/admob/reward/verifier-keys.json

# 3x-ui Panel
XUI_PANEL_URL=http://YOUR_VPS_IP:54321
XUI_USERNAME=your_3xui_username
XUI_PASSWORD=your_3xui_password
XUI_INBOUND_ID=1
```

### 2.3 PostgreSQL Setup (Local)

**Windows:**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install and remember the password for `postgres` user
3. Open pgAdmin or psql:
```sql
CREATE DATABASE bds_store_vpn;
CREATE USER bds_admin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE bds_store_vpn TO bds_admin;
```

**Or use Docker:**
```bash
docker run -d --name bds-postgres \
  -e POSTGRES_DB=bds_store_vpn \
  -e POSTGRES_USER=bds_admin \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2.4 Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# Sync database tables
npm run db:sync
```

### 2.5 Test the API

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Register a user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!", "username": "testuser"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!"}'
```

---

## 3. Google AdMob Setup

### 3.1 Create AdMob Account

1. Go to https://admob.google.com/
2. Sign in with your Google account
3. Create a new app → Select "Android" → Enter app name "BDS STORE VPN"
4. Note down your **App ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`)

### 3.2 Create Rewarded Ad Unit

1. In AdMob dashboard → Go to your app → **Ad units**
2. Click **Add ad unit** → Select **Rewarded**
3. Configure:
   - Ad unit name: "Free 2 Hours VPN"
   - Reward amount: 1
   - Reward item: "vpn_time"
4. Note down the **Ad Unit ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`)

### 3.3 Enable Server-Side Verification (SSV)

1. In AdMob → **Ad units** → Click on your rewarded ad unit
2. Go to **Server-side verification**
3. Enable it
4. Set the callback URL: `https://api.yourdomain.com/api/v1/ads/verify`
5. (Optional) Set a custom verification key

### 3.4 Test Ad Unit IDs (Development)

Use these during development:
```
# Android Rewarded Ad Test ID
ca-app-pub-3940256099942544/5224354917

# Android App ID Test
ca-app-pub-3940256099942544~3347511713
```

---

## 4. Flutter App (Hiddify-Next Fork) Setup

### 4.1 Prerequisites

```bash
# Install Flutter SDK
# Download from: https://flutter.dev/docs/get-started/install/windows

# Verify installation
flutter doctor

# Should show:
# [✓] Flutter
# [✓] Android toolchain
# [✓] Android Studio (or VS Code)
```

### 4.2 Fork Hiddify-Next

1. Go to https://github.com/hiddify/hiddify-next
2. Click **Fork** → Create fork to your GitHub account
3. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/hiddify-next.git
cd hiddify-next
```

### 4.3 Integrate BDS STORE Code

```bash
# Copy integration files
cp -r "BDS STORE/flutter_integration/lib/services" hiddify-next/lib/
cp -r "BDS STORE/flutter_integration/lib/widgets" hiddify-next/lib/
cp -r "BDS STORE/flutter_integration/lib/models" hiddify-next/lib/
cp -r "BDS STORE/flutter_integration/lib/config" hiddify-next/lib/
```

### 4.4 Add Dependencies

Add to `pubspec.yaml`:
```yaml
dependencies:
  google_mobile_ads: ^5.0.0
  http: ^1.2.0
  provider: ^6.1.0
  shared_preferences: ^2.2.0
```

Then run:
```bash
flutter pub get
```

### 4.5 Android Configuration

In `android/app/src/main/AndroidManifest.xml`, add inside `<application>`:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"/>
```

### 4.6 Change App Branding

1. Change app name in `android/app/src/main/AndroidManifest.xml`:
   ```xml
   android:label="BDS STORE VPN"
   ```
2. Change package name using `change_app_package_name` package
3. Replace app icon using `flutter_launcher_icons` package

---

## 5. Connecting Everything Together

### 5.1 Flow Diagram

```
User Opens App
    │
    ▼
Login/Register ──────────▶ Backend API ──▶ Create user in PostgreSQL
    │
    ▼
See "Get Free 2 Hours" button
    │
    ▼
Tap button ──▶ Show AdMob Rewarded Video
    │
    ▼
Watch full ad
    │
    ▼
AdMob SSV Callback ──────▶ Backend verifies signature
    │                           │
    │                           ▼
    │                      Add 2 hours to user's timeBalance
    │
    ▼
User taps "Connect" ─────▶ Backend checks timeBalance > 0
    │                           │
    │                           ▼
    │                      Backend calls 3x-ui API
    │                      Creates/fetches VLESS config
    │                           │
    ▼                           ▼
App receives VPN config ◀── Returns config to app
    │
    ▼
Connect to VPN server via VLESS/VMess
    │
    ▼
Countdown timer starts (deducting time)
    │
    ▼
Time runs out ──▶ Auto-disconnect ──▶ Backend disables 3x-ui client
```

### 5.2 Configuration Checklist

- [ ] VPS server running with 3x-ui Panel
- [ ] Backend API deployed with correct .env
- [ ] AdMob account with Rewarded Ad Unit
- [ ] AdMob SSV callback URL pointing to Backend
- [ ] Flutter app configured with correct API base URL
- [ ] Flutter app configured with correct AdMob App ID & Ad Unit ID
- [ ] SSL certificate for API domain
- [ ] Database migrated/synced

---

## 6. Production Deployment

### 6.1 Backend Deployment Options

**Option A: Railway.app (Easiest)**
1. Connect your GitHub repo
2. Add environment variables
3. Deploy automatically

**Option B: DigitalOcean App Platform**
1. Connect GitHub repo
2. Configure as Web Service
3. Add PostgreSQL database add-on

**Option C: VPS with Docker**
```bash
# On your VPS
git clone your-repo
cd your-repo
cp backend/.env.example backend/.env
# Edit .env with production values
docker-compose up -d
```

### 6.2 Flutter App Release

```bash
# Generate signing key
keytool -genkey -v -keystore ~/bds-store-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias bds-store

# Build APK
flutter build apk --release

# Build App Bundle (for Play Store)
flutter build appbundle --release
```

### 6.3 Play Store Submission

1. Go to https://play.google.com/console
2. Create new app → "BDS STORE VPN"
3. Upload App Bundle
4. Fill in store listing, screenshots, etc.
5. Submit for review

---

## 7. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Database connection failed | Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in .env |
| 3x-ui API not responding | Ensure API is enabled in 3x-ui Panel Settings |
| AdMob SSV not working | Verify callback URL is HTTPS and publicly accessible |
| Flutter build errors | Run `flutter clean` then `flutter pub get` |
| VPN not connecting | Check 3x-ui inbound config and firewall rules |
| JWT token expired | User needs to re-login, check JWT_EXPIRES_IN setting |

### Useful Commands

```bash
# Check backend logs
docker logs bds-store-api -f

# Check database
docker exec -it bds-store-db psql -U bds_admin -d bds_store_vpn

# Restart all services
docker-compose restart

# Rebuild and restart
docker-compose up -d --build
```
