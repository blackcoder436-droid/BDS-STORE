# BDS STORE VPN - Project Roadmap & Task List

BDS STORE VPN Project အောင်မြင်စွာ တည်ဆောက်ပြီးစီးရန်အတွက် အဆင့်ဆင့်လုပ်ဆောင်ရမည့် လုပ်ငန်းစဉ်များ (Roadmap) ကို ရှင်းလင်းစွာ ဖော်ပြထားပါသည်။ ဤဖိုင်ကို အသုံးပြု၍ လုပ်ငန်းစဉ်တစ်ခုပြီးတိုင်း Checkbox `[ ]` ကို `[x]` သို့ ပြောင်းလဲမှတ်သားသွားနိုင်ပါသည်။

---

## 🗺️ Project Roadmap at a Glance

```
Phase 1: Local Backend ──▶ Phase 2: VPN Infrastructure ──▶ Phase 3: Middleware Link
                                                                  │
                                                                  ▼
Phase 6: App Release ◀── Phase 5: Flutter App Fork ◀── Phase 4: AdMob & SSV
```

---

## 📋 Detailed Task Checklist

### Phase 1: Local Backend & Database Setup (ယခုလုပ်ဆောင်ဆဲ)
အာရုံစိုက်ရမည့်အချက်: *Local စက်ပေါ်တွင် Backend API နှင့် Database ကို စနစ်တကျ အလုပ်လုပ်စေရန်။*

- [ ] **1.1. Environment Configuration**
  - [ ] `backend/.env.example` ကို `.env` သို့ Copy ကူးပါ။
  - [ ] `.env` ထဲတွင် local settings များ (PORT, JWT_SECRET စသည်) ကို သတ်မှတ်ပါ။
- [ ] **1.2. PostgreSQL Database Setup**
  - [ ] Local PostgreSQL database `bds_store_vpn` ကို ဆောက်ပါ။
  - [ ] `.env` တွင် Database username နှင့် password ကို ထည့်သွင်းပါ။
  - [ ] `npm run db:sync` command ဖြင့် table schema များကို database ထဲသို့ sync လုပ်ပါ။
- [ ] **1.3. Local API Test**
  - [ ] `npm run dev` ဖြင့် backend ကို စတင်ပတ်ပါ။
  - [ ] API Health Check (`http://localhost:3000/api/v1/health`) အလုပ်လုပ်မလုပ် စစ်ဆေးပါ။
  - [ ] Postman (သို့မဟုတ်) Thunder Client သုံးပြီး Register/Login endpoint များကို စမ်းသပ်ပါ။

---

### Phase 2: VPN Infrastructure (VPS & 3x-ui Setup)
အာရုံစိုက်ရမည့်အချက်: *VPN ချိတ်ဆက်မှုကို လက်ခံပေးမည့် Server Node များ တည်ဆောက်ရန်။*

- [ ] **2.1. VPS Server ဝယ်ယူခြင်း**
  - [ ] Ubuntu 22.04 LTS တင်ထားသော VPS တစ်ခု ဝယ်ယူပါ။ (Hetzner, Vultr, DigitalOcean)
- [ ] **2.2. 3x-ui Panel တပ်ဆင်ခြင်း**
  - [ ] VPS သို့ SSH ဝင်ပြီး 3x-ui script ကို run ပြီး install လုပ်ပါ။
  - [ ] Web Admin dashboard ဝင်ရန် Port နှင့် Base path သတ်မှတ်ပါ။
  - [ ] Web panel Settings တွင် **API Enable** ဖြစ်နေကြောင်း သေချာပါစေ။
- [ ] **2.3. VPN Protocols (Inbounds) ဆောက်ခြင်း**
  - [ ] 3x-ui Panel ထဲတွင် VLESS (Reality သို့မဟုတ် TLS သုံးသော) Inbound အသစ်တစ်ခု ဆောက်ပါ။
  - [ ] Inbound ID ကို မှတ်သားထားပါ။ (Backend နှင့် ချိတ်ဆက်ရန် လိုအပ်သည်)

---

### Phase 3: Middleware Integration (Backend ↔ 3x-ui Panel)
အာရုံစိုက်ရမည့်အချက်: *Backend မှတစ်ဆင့် VPN Server သို့ API ဖြင့် လှမ်းချိတ်ရန်။*

- [ ] **3.1. Configure 3x-ui in Backend**
  - [ ] `backend/.env` ရှိ `XUI_PANEL_URL`, `XUI_USERNAME`, `XUI_PASSWORD` နေရာတွင် VPS အချက်အလက်များ ဖြည့်ပါ။
  - [ ] `XUI_INBOUND_ID` ကို ဖြည့်ပါ။
- [ ] **3.2. Integration Test**
  - [ ] Backend API ကို test login လုပ်ပြီး vpn config endpoint (`/api/v1/vpn/config`) သို့ request ပို့ကြည့်ပါ။
  - [ ] User ID အလိုက် client config တစ်ခု 3x-ui panel ထဲတွင် auto-create ဖြစ်သွားခြင်း ရှိမရှိ စမ်းသပ်ပါ။

---

### Phase 4: Google AdMob & SSV Verification Setup
အာရုံစိုက်ရမည့်အချက်: *Ad ကြည့်ပြီး အချိန်ရယူနိုင်သည့် စနစ်ကို စိတ်ချရစေရန် Backend တွင် ချိတ်ဆက်ရန်။*

- [ ] **4.1. AdMob Account & Ad Unit**
  - [ ] Google AdMob Account ဖွင့်ပါ။
  - [ ] Android App အသစ်တစ်ခု တည်ဆောက်ပြီး **Rewarded Ad Unit** တစ်ခု ဆောက်ပါ။
- [ ] **4.2. Server-Side Verification (SSV) ဖွင့်ခြင်း**
  - [ ] Ad unit setting ထဲတွင် SSV ကို Enable လုပ်ပါ။
  - [ ] Callback URL ကို ဖြည့်သွင်းပါ။ (ဥပမာ- `https://your-api.com/api/v1/ads/verify`)
- [ ] **4.3. SSV Signature Verification Test**
  - [ ] Backend developer mode တွင် Google verification keys များ cache လုပ်နိုင်ခြင်း ရှိမရှိ logger တွင် ကြည့်ရှုစစ်ဆေးပါ။

---

### Phase 5: Flutter App (Hiddify-Next Fork) Integration
အာရုံစိုက်ရမည့်အချက်: *Hiddify client app ၏ UI နှင့် Core logic များကို BDS STORE အဖြစ် ပြင်ဆင်ရန်။*

- [ ] **5.1. Setup Flutter Environment**
  - [ ] စက်ထဲတွင် Flutter SDK နှင့် Android Studio/VS Code တပ်ဆင်ပါ။
- [ ] **5.2. Fork & Copy Integration Files**
  - [ ] Hiddify-Next repository ကို Fork/Clone လုပ်ပါ။
  - [ ] `flutter_integration/lib` အောက်ရှိ directory များနှင့် ဖိုင်အားလုံးကို Hiddify project ၏ `lib/` အောက်သို့ ကူးထည့်ပါ။
- [ ] **5.3. Bind with Hiddify VPN Engine**
  - [ ] `lib/widgets/vpn_home_screen.dart` ရှိ "Connect" ခလုပ်နှိပ်ပါက Hiddify's core connection method ကို ခေါ်ရန် ချိတ်ဆက်ပါ။
  - [ ] ApiService မှ ရလာသော VLESS config key ကို Hiddify's import config method သို့ သွင်းပေးရန် ချိတ်ဆက်ပါ။

---

### Phase 6: App Branding & Final Testing
အာရုံစိုက်ရမည့်အချက်: *App တစ်ခုလုံးကို ကိုယ်ပိုင်အမှတ်တံဆိပ် BDS STORE အဖြစ် ပြောင်းလဲပြီး စမ်းသပ်ရန်။*

- [ ] **6.1. Branding & Identity**
  - [ ] App Display Name ကို "BDS STORE" ဟု ပြောင်းပါ။
  - [ ] Package Name (Application ID) ကို `com.bdsstore.vpn` သို့မဟုတ် `com.bds.store` သို့ ပြောင်းပါ။
  - [ ] App Launch Icons နှင့် UI logo များကို ကိုယ်ပိုင် BDS STORE logo ဖြင့် အစားထိုးပါ။
- [ ] **6.2. End-to-End User Flow Test**
  - [ ] Emulator သို့မဟုတ် Physical device ပေါ်တွင် app ကို run ပါ။
  - [ ] Register ဖွင့်ခြင်း ──▶ AdMob video ad ကြည့်ခြင်း ──▶ VPN အချိန် ၂ နာရီ တိုးသွားခြင်း ──▶ One-tap connect ဖြင့် VPN ချိတ်ဆက်နိုင်ခြင်း ──▶ အချိန်ကုန်ပါက auto-disconnect ဖြစ်ခြင်း အဆင့်ဆင့်ကို အစအဆုံး စမ်းသပ်ပါ။

---

### Phase 7: Production Deployment
အာရုံစိုက်ရမည့်အချက်: *ဝန်ဆောင်မှုကို လူတိုင်းအသုံးပြုနိုင်စေရန် Live လွှင့်တင်ခြင်း။*

- [ ] **7.1. Domain Name & SSL**
  - [ ] API server အတွက် Domain တစ်ခုဝယ်ပြီး API subdomain ကို Cloudflare သို့မဟုတ် Domain DNS တွင် ညွှန်ပြပါ။
  - [ ] VPS တွင် Nginx/Certbot သုံးပြီး SSL HTTPS setup ပြုလုပ်ပါ။
- [ ] **7.2. Production Hosting**
  - [ ] Backend API server ကို Docker compose သုံးပြီး production VPS ပေါ်တွင် တင်ပါ (သို့မဟုတ် Railway, Render တို့တွင် တင်ပါ)။
  - [ ] Database backups စနစ် ပြုလုပ်ထားပါ။

---

### Phase 8: Play Store Console App Release
အာရုံစိုက်ရမည့်အချက်: *အများပြည်သူ ဒေါင်းလုဒ်ဆွဲနိုင်ရန် Google Play Store ပေါ်သို့ တင်ပို့ခြင်း။*

- [ ] **8.1. Build Release Version**
  - [ ] Android App Bundle (`.aab`) ဖိုင်ကို release mode ဖြင့် build လုပ်ပါ။
- [ ] **8.2. Play Console Submission**
  - [ ] Google Play Console account ဖွင့်ပြီး App information၊ screenshots နှင့် privacy policy များ ဖြည့်စွက်ပါ။
  - [ ] `.aab` ဖိုင်ကို တင်ပြီး Review တင်ပါ။

---

## 🛡️ နောက်ပိုင်း ထည့်သွင်းစဉ်းစားသင့်သည့် အချက်များ (Future Improvements)

1. **Multi-Server Node (Load Balancing):**
   * အသုံးပြုသူများလာပါက VPN server node တစ်ခုတည်းဖြင့် မလောက်ငှနိုင်ပါ။ Backend တွင် server node စာရင်းသိမ်းဆည်းပြီး status ကောင်းသော node သို့ user များကို dynamic ခွဲဝေပေးနိုင်ရန် ဖန်တီးပါ။
2. **Notification System:**
   * VPN သက်တမ်းကုန်ခါနီးအချိန် (ဥပမာ- ၅ မိနစ်အလို) တွင် user ဖုန်းထဲသို့ Push Notification ပို့ပြီး Ads ပြန်ကြည့်ရန် သတိပေးသည့်စနစ် ထည့်သွင်းပါ။
3. **Analytics Integration:**
   * Firebase Analytics သို့မဟုတ် Mixpanel ထည့်သွင်းပြီး မည်သည့် Server ကို အသုံးအများဆုံးလဲ၊ user retention ဘယ်လောက်ရှိလဲ စောင့်ကြည့်ပါ။
