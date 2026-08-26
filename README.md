<div align="center">

<img src="https://raw.githubusercontent.com/khushichauhan05/xmind-app/master/Mobile/assets/images/xMind-Logo1.png" alt="xMind logo — open-source React Native social media app built with Expo SDK 54" width="120" />

# 🧠 xMind

**An open-source React Native social media app for fast, calm, intentional sharing — built end-to-end with Expo SDK 54 and TypeScript.**

[![Stars](https://img.shields.io/github/stars/khushichauhan05/xmind-app?style=for-the-badge&logo=github&color=F0466A&labelColor=0E0E12)](https://github.com/khushichauhan05/xmind-app/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/khushichauhan05/xmind-app?style=for-the-badge&labelColor=0E0E12)](https://github.com/khushichauhan05/xmind-app/commits/master)
[![Top language](https://img.shields.io/github/languages/top/khushichauhan05/xmind-app?style=for-the-badge&labelColor=0E0E12)](https://github.com/khushichauhan05/xmind-app)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge&labelColor=0E0E12)](#-contributing)

<a href="#-getting-started"><strong>Getting Started</strong></a> ·
<a href="./zero-to-deploy.md"><strong>Deploy Guide</strong></a> ·
<a href="https://github.com/khushichauhan05/xmind-app/issues"><strong>Report Bug</strong></a> ·
<a href="https://github.com/khushichauhan05/xmind-app/issues/new?labels=enhancement"><strong>Request Feature</strong></a>

</div>

---

> **Credit:** This project is based on the original [xMind](https://github.com/aashir-athar/xmind-app) by [@aashir-athar](https://github.com/aashir-athar). Full credit to the original author for the source work. This repository is maintained and extended by [@khushichauhan05](https://github.com/khushichauhan05).

## Overview

**xMind** is a production-grade, open-source social network you can clone, study, and ship. It's a complete reference for building a modern, cross-platform mobile social media app on **React Native + Expo SDK 54** — strict TypeScript, a server-paginated infinite feed, optimistic mutations, fuzzy on-device search, an on-device personalised feed ranker, real-time-feeling chat, and a token-driven design system that adapts across iOS and Android.

Most social-media tutorials stop at "a list of posts." xMind starts where they end — with reshares, a reshare graph, a TF-IDF + MMR ranking pipeline, and a backend engineered to scale on serverless. The app is tuned to feel smooth even on a 2 GB-RAM Android device.

> 🚧 **Active development.** Core feed, chat, reshares, profiles, and search are working; some items on the [roadmap](#️-roadmap) (stories backend, push notifications, web build) are still in progress.

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🧠 | **On-device feed ranker** | Layered scorer in pure TypeScript — TF-IDF cosine relevance, exposure decay, MMR diversity rerank, per-author cap, and cold-start fallback. Deterministic and sub-millisecond per page. |
| ♾️ | **Cursor-paginated infinite feed** | TanStack `useInfiniteQuery` with `onEndReached`, native pull-to-refresh, and optimistic like / reshare / delete that never invalidates the whole list. |
| 🔁 | **Reshare graph** | First-class repost model with `originalPost` linkage, atomic idempotent toggles, author notifications, and automatic purge of dangling reshares. |
| 💬 | **Real-time-feeling chat** | Inbox + thread screens with idempotent `clientId`-keyed sends, FlashList v2 `maintainVisibleContentPosition`, AppState-aware polling, and tappable shared-post preview cards in DMs. |
| 🔍 | **Fuzzy search** | `Fuse.js` indices over users and posts, leading-`@` tolerance, merged with debounced server-side search. Feels instant on every keystroke. |
| 🎨 | **Token-driven design system** | Primitive → semantic → CSS-variable token chain that flips the whole UI on `prefers-color-scheme`. One designer's hand across every card. |
| ⚡ | **120 fps animations** | Reanimated v4 worklets on the UI thread for every press, like burst, and screen transition. No JS-thread animations anywhere. |
| 🛡️ | **Backend that scales** | Cached MongoDB connection across serverless cold starts, atomic toggles, Mongo indexes on every hot query, and an Arcjet bot / rate-limit shield. |
| 🔐 | **Clerk auth + Cloudinary** | Social sign-in with a server-side profile-sync bridge, plus on-the-fly Cloudinary image transforms for posts, avatars, and banners. |

## 🛠️ Tech Stack

**Mobile**

![Expo SDK 54](https://img.shields.io/badge/Expo-SDK_54-000?style=for-the-badge&logo=expo&logoColor=fff)
![React Native](https://img.shields.io/badge/React_Native-0.81-61dafb?style=for-the-badge&logo=react&logoColor=000)
![React 19](https://img.shields.io/badge/React-19.1-61dafb?style=for-the-badge&logo=react&logoColor=000)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=fff)
![NativeWind](https://img.shields.io/badge/NativeWind-4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=fff)
![Reanimated](https://img.shields.io/badge/Reanimated-v4-001A72?style=for-the-badge&logo=react&logoColor=fff)

- **Expo Router v6** file-based routing with the `(tabs)` group
- **TanStack React Query v5** — `useInfiniteQuery`, optimistic mutations
- **FlashList v2** for every virtualised list, **expo-image** for caching
- **Zustand + AsyncStorage** for session and feedback stores
- **Clerk Expo** auth, **Fuse.js** fuzzy search, **expo-haptics / expo-blur / expo-glass-effect**

**Backend**

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=fff)
![Express](https://img.shields.io/badge/Express-5-000?style=for-the-badge&logo=express&logoColor=fff)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=fff)
![Cloudinary](https://img.shields.io/badge/Cloudinary-CDN-3448C5?style=for-the-badge&logo=cloudinary&logoColor=fff)

- **Express 5** (ES modules) + **Mongoose 8** on **MongoDB Atlas**
- **Clerk Express** middleware, **Cloudinary** image hosting
- **Arcjet** shield, bot detection, and token-bucket rate limiting
- Cached Mongoose connection + `compression` for serverless deploys

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18 and **Git**
- An iOS Simulator (macOS) or Android Emulator (any OS)
- Free-tier accounts: **MongoDB Atlas**, **Clerk**, **Cloudinary**, **Arcjet**

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/khushichauhan05/xmind-app.git
cd xmind-app

# 2. Install backend deps and start the API on http://localhost:5001
cd Backend
npm install
cp .env.example .env   # then fill it in (see Configuration below)
npm run dev

# 3. In a second terminal, start the mobile app
cd ../Mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your LAN IP
npx expo start --clear
```

Press `i` for iOS or `a` for Android. On a **physical device**, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP — not `localhost`.

For full deploy instructions (EAS Build, Atlas, Clerk, Cloudinary, Arcjet), read **[zero-to-deploy.md](./zero-to-deploy.md)**.

<details>
<summary><strong>Configuration & environment variables</strong></summary>

**Backend `.env`**

```dotenv
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<pwd>@<cluster>/xmind?retryWrites=true&w=majority
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ARCJET_KEY=ajkey_...
ALLOWED_ORIGINS=https://your-web-dashboard.example.com
```

**Mobile `.env`**

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.42:5001/api
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Never commit either file — `.gitignore` already excludes them.

</details>

## 📖 Usage

xMind is a monorepo with two apps. Common commands:

| Where | Command | What it does |
|---|---|---|
| `Mobile/` | `npm start` | Metro bundler (iOS + Android + Web) |
| `Mobile/` | `npm run ios` | Open in the iOS Simulator |
| `Mobile/` | `npm run android` | Open in the Android Emulator |
| `Mobile/` | `npm run lint` | ESLint with Expo's ruleset |
| `Mobile/` | `npx tsc --noEmit` | Strict TypeScript check |
| `Backend/` | `npm run dev` | Express with `node --watch` |
| `Backend/` | `npm start` | Production start |

<details>
<summary><strong>How the feed ranker works</strong></summary>

The feed is a layered scorer — every signal is a pure, individually exported function that can be unit-tested in isolation:

| Layer | Signal | Notes |
|---|---|---|
| Hard filters | Muted / blocked / max-age / low-quality | Removed up-front |
| Topical relevance | TF-IDF cosine vs. the user's interaction profile | Hashtags 3× weighted |
| Engagement velocity | Likes + comments per hour | Log-normalised by author followers |
| Time decay | Half-life decay | Active-hour multiplier for the user's timezone |
| Diversity rerank | MMR (λ = 0.7) | Prevents 10 posts about the same hashtag in a row |
| Per-author cap | ≤ 2 posts | One person never dominates the feed |
| Cold start | Discover-mode fallback | Until interaction count ≥ 5 |

The ranker is deterministic — no `Math.random()`. Same inputs, same order, so scroll position stays stable across re-renders. Because ranking runs on-device, the backend stays a stateless, cacheable cursor API.

</details>

## 🗺️ Roadmap

- [x] Reshares with `originalPost` graph + reshare notifications
- [x] Tappable @mentions and #hashtags in posts and comments
- [x] Reply-to-comment threading
- [x] Followers / Following management (Remove + Unfollow)
- [x] Shared-post preview cards in chat (no raw links)
- [ ] Quote-reshare (carry resharer commentary above the source post)
- [ ] @mentions autocomplete in the composer
- [ ] WebSocket transport for chat (Pusher / Ably swap)
- [ ] Stories backend (currently UI-only on the home rail)
- [ ] Push notifications (EAS Build + APNs / FCM)
- [ ] Web build and an end-to-end test pass with Maestro

Want to own one of these? [Open an issue](https://github.com/khushichauhan05/xmind-app/issues/new) and it'll be tagged `good first issue` or `help wanted`.

## 🤝 Contributing

Contributions are welcome and encouraged — code or docs, big or small.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-thing`)
3. Make your change, then verify with `cd Mobile && npx tsc --noEmit && npm run lint`
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat(home): ...`)
5. Push and open a Pull Request

**House rules:** TypeScript strict (no `any`), use the design tokens (no inline hex / magic spacing), and install new deps via `npx expo install <pkg>` so SDK 54 versions pin correctly.

## 📄 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for details.

## 👤 Maintainer

**Khushi Chauhan**

[![GitHub](https://img.shields.io/badge/GitHub-khushichauhan05-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/khushichauhan05)

**Original author:** [Aashir Athar](https://github.com/aashir-athar) — [GitHub](https://github.com/aashir-athar) · [LinkedIn](https://www.linkedin.com/in/aashirathar/) · [X](https://x.com/aashirathar)

---

<div align="center">

<sub>Original project by <a href="https://github.com/aashir-athar">aashir-athar</a>, maintained by <a href="https://github.com/khushichauhan05">khushichauhan05</a>. If xMind helped you, consider leaving a ⭐.</sub>

<br/><br/>

<sub><b>Keywords:</b> react native social media app · expo sdk 54 · typescript social network · on-device feed ranker · tf-idf mmr feed ranking · nativewind · expo router · tanstack query · mongodb express backend · clerk auth · cross-platform ios android · open-source social app</sub>

</div>
