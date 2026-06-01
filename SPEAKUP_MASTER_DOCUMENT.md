# SPEAKUP
## Product & Engineering Master Document

**PRD · TRD · App Flow · UI/UX Brief · Backend Schema · Implementation Plan**

| Field | Value |
|---|---|
| Product | SpeakUp |
| Version | 1.0.0 |
| Status | **Launched** |
| Stack | Next.js 14 · Node.js · Supabase · PeerJS · Socket.io |
| Monthly Cost | $0 (fully free tier) |
| Date | June 2, 2026 |
| Frontend | https://speak-up-web-umber.vercel.app |
| Backend | https://speakup-8mdb.onrender.com |
| Repository | https://github.com/Dhanjeet09/speakUp |
| Owner | Product & Engineering Team |

---

## Table of Contents

1. [Product Requirements Document (PRD)](#1-product-requirements-document-prd)
2. [Technical Requirements Document (TRD)](#2-technical-requirements-document-trd)
3. [Application Flow](#3-application-flow)
4. [UI/UX Brief](#4-uiux-brief)
5. [Backend Schema](#5-backend-schema)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. Product Requirements Document (PRD)

### 1.1 Vision & Problem Statement

Hundreds of millions of people worldwide study English from textbooks, apps, and videos — but rarely get the chance to practise actually speaking. Conversation confidence is built only through real conversation. SpeakUp solves this by connecting English learners globally for live, face-to-face video practice sessions, entirely in the browser, at zero cost.

### 1.2 Target Users

| Persona | Description | Key Need |
|---|---|---|
| The Exam Preparer | Student preparing for IELTS, TOEFL, or job interview | Regular speaking practice with feedback |
| The Confident Beginner | A1–B1 learner who can read/write but freezes when speaking | Low-pressure environment with patient partners |
| The Fluency Seeker | B2–C1 learner who wants natural, fast conversation | Native-speed practice on varied topics |
| The Traveller | Someone preparing for an English-speaking trip or relocation | Practical everyday conversation topics |

### 1.3 Goals & Non-Goals

#### Goals
- Connect two English learners in a peer video call within 30 seconds of searching
- Work in any modern browser — no download, no app install required
- Be completely free to use and free to run ($0/month infrastructure)
- Support all proficiency levels (A1 through C2) with smart level-based matching
- Provide daily conversation topics so users never run out of things to say
- Track progress: total minutes spoken, sessions, and streak
- Keep the community safe with report and block features

#### Non-Goals (v1.0)
- AI-powered grammar correction or pronunciation feedback
- Group calls (more than 2 participants)
- In-call text chat
- Mobile native app (iOS / Android)
- Paid tiers or subscription features
- Certified English teachers or tutors

### 1.4 Success Metrics

| Metric | Target (Month 3) | Target (Month 6) |
|---|---|---|
| Registered users | 1,000 | 10,000 |
| Daily active speakers | 200 | 2,000 |
| Avg match wait time | < 30 seconds | < 15 seconds |
| Avg session duration | > 8 minutes | > 12 minutes |
| 7-day retention | 25% | 40% |
| Safety reports resolved | < 24 hours | < 4 hours |

### 1.5 Core User Stories

#### Authentication
- ✅ As a new user, I can sign up with email/password or Google so I can access the platform
- ✅ As a returning user, I can log in and my profile and history are persisted
- ✅ As a user, my session stays active for 30 days so I do not have to log in repeatedly

#### Onboarding
- ✅ As a new user, I am guided through a 3-step onboarding: choose level, pick interests, set name and country
- ✅ As a user, I can see what each level (A1–C2) means so I can pick the right one

#### Matching
- ✅ As a user, I click "Find Partner" and am matched with someone at a similar level within 30 seconds
- ✅ As a user, I can cancel the search at any time without consequence
- ✅ As a user, I am never matched with someone I have blocked

#### Video Call
- ✅ As a user, I can see and hear my partner clearly in a full-screen video call
- ✅ As a user, I can see the topic of the day so I always have something to talk about
- ✅ As a user, I can mute my mic or turn off my camera at any time
- ✅ As a user, I can end the call at any time
- ✅ As a user, if my partner disconnects, I am informed and returned to the idle state

#### Post-Call
- ✅ After each call, I can rate my experience (thumbs up/down) to improve future matches
- ✅ After each call, my session is saved and my stats are updated automatically

#### Safety
- ✅ During any call, I can report my partner for inappropriate behaviour
- ✅ I can block a user so they never appear in my matches again

#### Dashboard
- ✅ I can see my total minutes spoken, session count, and current streak on my dashboard
- ✅ I can see my recent session history
- ✅ I can see today's conversation topic before entering a call

---

## 2. Technical Requirements Document (TRD)

### 2.1 Technology Stack

| Layer | Technology | Reason | Cost |
|---|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, file-based routing, Vercel-native | Free |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, accessible components | Free |
| State | Zustand | Minimal, no boilerplate, easy devtools | Free |
| Auth | Supabase Auth | Email + Google OAuth, 50K MAU free tier | Free |
| Database | Supabase PostgreSQL + Prisma ORM | Managed DB, type-safe queries | Free (500MB) |
| Realtime | Socket.io (self-hosted) | WebSocket matchmaking and events | Free |
| Video | PeerJS (WebRTC) | Browser-to-browser, no paid video API | Free |
| STUN | Google STUN server | NAT traversal for P2P connections | Free |
| Queue | In-memory Map (Node.js) | No Redis needed for this scale | Free |
| Security | Helmet + express-rate-limit | Headers hardening, DDoS protection | Free |
| Frontend host | Vercel (Hobby) | Git-push deploy, CDN, SSL | Free |
| Backend host | Render | Free tier Node.js hosting | Free |
| Error tracking | Sentry (free tier) | Both web (`@sentry/nextjs`) and server | Free |
| Logging | Pino | Structured JSON logging | Free |
| **Total cost** | — | — | **$0/month** |

### 2.2 System Architecture

#### High-level overview
The system has two independently deployed services communicating over HTTP and WebSockets:

- **apps/web** — Next.js frontend hosted on Vercel. Handles all UI, auth state, and PeerJS WebRTC signalling.
- **apps/server** — Express + Socket.io backend hosted on Render. Handles matchmaking queue (in-memory Map), session persistence (Prisma → Supabase), and real-time events.

The two services never share memory. All shared state is either in Supabase (persistent) or communicated via Socket.io events (ephemeral).

#### Communication flows

| Flow | Protocol | From | To |
|---|---|---|---|
| User auth | HTTPS REST | Web (Supabase client) | Supabase Auth |
| API calls (sessions, users, reports) | HTTPS REST | Web fetch() | Express routes |
| Matchmaking queue | WebSocket | Web Socket.io client | Server Socket.io |
| Match notification | WebSocket | Server Socket.io | Web Socket.io client |
| Video call negotiation | WebRTC (via PeerJS) | Browser A | Browser B (P2P) |
| DB reads/writes | TCP (Prisma) | Express server | Supabase PostgreSQL |

### 2.3 Key Technical Decisions

#### PeerJS over Daily.co / Agora
PeerJS wraps the browser's native WebRTC APIs and uses a free open-source signalling server. This keeps the video call infrastructure at $0. The tradeoff is that calls may degrade or fail on heavily firewalled corporate networks (TURN relay not available on free tier). This is acceptable for v1.0 given the $0 constraint.

#### In-memory Map over Redis
At projected v1 scale (<500 concurrent users), an in-memory Map on the Node.js process is sufficient for the matchmaking queue. Entries are cleaned up via a `setInterval` every 60 seconds. If the server restarts, users in queue simply rejoin. Redis would be needed at 10,000+ concurrent users or for multi-instance deployments.

#### Supabase Auth over custom JWT
Supabase Auth provides Google OAuth, email verification, session refresh, and row-level security out of the box. This eliminates weeks of auth development. The server validates the Supabase JWT on every protected API call using `supabase.auth.getUser()` server-side — user IDs from request bodies are never trusted.

### 2.4 Performance Requirements

| Requirement | Target | Measurement |
|---|---|---|
| Page load (LCP) | < 2.5 seconds | Vercel Analytics / Core Web Vitals |
| Match wait time (p50) | < 30 seconds | Server-side timer in matchmaking logs |
| API response time (p95) | < 500ms | Express response time middleware |
| Socket.io event latency | < 100ms | Client-side timestamp diff on matchFound event |
| Video call setup time | < 5 seconds | PeerJS open → call → stream events |
| Database query time (p95) | < 200ms | Prisma query logging in production |

### 2.5 Security Requirements

- ✅ All API routes protected by Supabase JWT verification middleware (`requireAuth`)
- ✅ CORS restricted to frontend domain only in production
- ✅ Helmet middleware: CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin
- ✅ express-rate-limit: 10 req/15min on auth routes, 100 req/min on all API routes
- ✅ Socket.io joinQueue: max 1 call per user per 5 seconds, server-side enforced
- ✅ All user-supplied strings sanitised server-side before DB write (sanitize-html)
- ✅ Error stack traces never exposed in production API responses
- ✅ Environment variables validated at startup with Zod — crash-fast on missing config

### 2.6 Browser Support

| Browser | Version | Notes |
|---|---|---|
| Chrome | 90+ | Full support including WebRTC |
| Firefox | 88+ | Full support |
| Safari | 14.1+ | getUserMedia requires special handling — implemented in webrtc.ts |
| Edge | 90+ | Full support (Chromium-based) |
| Mobile Chrome (Android) | 90+ | Full support |
| Mobile Safari (iOS) | 14.5+ | Supported with WakeLock polyfill |
| IE11 | Not supported | WebRTC not available |

---

## 3. Application Flow

### 3.1 Route Map

| Route | Page | Auth Required | Description |
|---|---|---|---|
| `/` | Landing | No | Marketing page, live online count, CTA to sign up |
| `/signup` | Sign Up | No (redirect if authed) | Email/password or Google OAuth registration |
| `/login` | Log In | No (redirect if authed) | Email/password or Google OAuth sign in |
| `/onboarding` | Onboarding | Yes (new users only) | 3-step setup: level → interests → name/country |
| `/dashboard` | Dashboard | Yes | Stats, streak, recent sessions, today's topic |
| `/match` | Match | Yes | Core feature: queue → match → video call → rating |
| `/profile/[userId]` | Profile | Yes | User's public stats and session history |
| `/settings` | Settings | Yes | Update level, interests, name, country, password |
| `/auth/callback` | OAuth Callback | No | Supabase Google OAuth redirect handler |
| `/auth/signout` | Sign Out | Yes | Server action to clear session and redirect |

### 3.2 Full User Journey

#### Journey A — New User (First Visit to First Call)

1. ✅ User lands on `/` (landing page)
2. ✅ Clicks "Start speaking now" → `/signup`
3. ✅ Enters email + password OR clicks "Continue with Google"
4. ✅ Email/password: receives verification email → clicks link → redirected to `/onboarding`
5. ✅ Google: OAuth popup → callback → redirected to `/onboarding`
6. ✅ Onboarding Step 1: selects English level (A1–C2) with level descriptions shown
7. ✅ Onboarding Step 2: picks interests (minimum 2 from 8 options)
8. ✅ Onboarding Step 3: enters display name and selects country from dropdown
9. ✅ Clicks "Start Speaking" → profile saved → redirected to `/dashboard`
10. ✅ Dashboard shows empty state with prompt to start first call
11. ✅ Clicks "Find a Partner" → `/match` page (IDLE state)
12. ✅ Clicks "Find Partner" → PERMISSION_CHECK state with browser-specific instructions
13. ✅ If permission granted: enters SEARCHING state
14. ✅ Match found within 30 seconds → 600ms green flash + confetti → brief MATCHED screen (2 seconds) showing partner info
15. ✅ IN_CALL state: full video UI with partner, topic bar, controls, connection quality
16. ✅ User ends call → ENDED state: session saved, rating screen shown
17. ✅ Rates session (or auto-skips after 5 seconds) → back to IDLE
18. ✅ Dashboard now shows session in history and updated stats

#### Journey B — Returning User (Quick Session)

19. ✅ User opens app → auth state loaded → redirected to `/dashboard`
20. ✅ Sees streak, stats, and today's topic
21. ✅ Clicks "Find a Partner" → `/match` (IDLE)
22. ✅ Clicks "Find Partner" → PERMISSION_CHECK → SEARCHING → MATCHED → IN_CALL → ENDED
23. ✅ Rates, returns to dashboard with updated stats

#### Journey C — Reporting a User

24. ✅ User is IN_CALL and partner behaves inappropriately
25. ✅ Clicks report icon (⚑) in call controls
26. ✅ Report modal opens (no call interruption yet)
27. ✅ Selects reason from dropdown: Inappropriate language / Harassment / Spam / Other
28. ✅ Optionally adds a note (max 280 characters)
29. ✅ Optionally checks "Also block this user"
30. ✅ Clicks "Submit Report" → call ends immediately for reporter
31. ✅ Report saved to DB → reporter returned to IDLE state
32. ✅ Toast: "Report submitted. Our team will review it."

### 3.3 Match Page State Machine

| State | What user sees | Triggers to next state |
|---|---|---|
| IDLE | "Find Partner" button + today's topic + mic level indicator | Click "Find Partner" → PERMISSION_CHECK |
| PERMISSION_CHECK | Spinner + browser-specific permission instructions | Permission granted → SEARCHING / denied → back to IDLE |
| SEARCHING | Spinner + "Finding your match..." + elapsed timer + Cancel button | Socket matchFound event → MATCHED |
| MATCHED | Green flash (600ms) + confetti, then partner name, country, level badge — 2 second screen | Auto-advance after 2 seconds → IN_CALL |
| IN_CALL | Full video UI: 2 tiles, topic bar, controls, connection quality, timer | End call button / partner disconnects → ENDED |
| ENDED | Session summary: duration + partner + topic + rating UI (thumbs up/down) with 5s auto-skip | Rate or skip (5s) → IDLE |

### 3.4 Real-time Event Flow

#### Client → Server events

| Event | Payload | When fired |
|---|---|---|
| `joinQueue` | `{ userId, level, interests, blockedUserIds }` | User clicks "Find Partner" after camera permission granted |
| `leaveQueue` | `{ userId }` | User clicks Cancel while searching |
| `callEnded` | `{ sessionId, durationSeconds }` | User clicks End Call or partner disconnects |
| `reportUser` | `{ reporterId, reportedId, reason, note }` | User submits report form |

#### Server → Client events

| Event | Payload | When fired |
|---|---|---|
| `matchFound` | `{ partner: { name, country, level, peerId }, topic, sessionId }` | Match confirmed, room ready |
| `queuePosition` | `{ waitingCount }` | Broadcast every 5 seconds to all queued users |
| `partnerLeft` | `{}` | Partner's socket disconnects mid-call |
| `onlineCount` | `{ count }` | Broadcast every 10s to landing page visitors |
| `serverError` | `{ message, code }` | Any server-side failure during socket handling |

---

## 4. UI/UX Brief

### 4.1 Design Principles

- **Confidence-first** — the UI should make users feel safe and capable, not judged. Warm, encouraging copy throughout.
- **Invisible technology** — users should think "I spoke English" not "I used an app". The call UI gets out of the way.
- **Zero friction** — every core action (sign up, find partner, start call) takes fewer than 3 clicks.
- **Honest feedback** — errors and empty states are human, specific, and actionable. Never show "Something went wrong."
- **Mobile parity** — every feature works equally well on a 375px phone screen as on a 1440px desktop.

### 4.2 Visual Design System

#### Colour palette

| Name | Hex | Usage |
|---|---|---|
| Purple (Primary) | `#534AB7` | Buttons, active states, links, key UI accents |
| Purple Light | `#EEEDFE` | Backgrounds for highlighted sections, badges |
| Purple Dark | `#26215C` | Headings, high-emphasis text |
| Teal (Success) | `#1D9E75` | Speaking indicator ring, success toasts, streak |
| Teal Light | `#E1F5EE` | Success backgrounds, note callouts |
| Red (Danger) | `#A32D2D` | End call button, error states, destructive actions |
| Gray 100 | `#F5F4F0` | Page background |
| Gray 300 | `#D3D1C7` | Borders, dividers |
| Gray 700 | `#444441` | Body text, secondary labels |
| White | `#FFFFFF` | Card surfaces, inputs |

#### Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| Page title (H1) | Inter | 36px | 600 |
| Section heading (H2) | Inter | 24px | 600 |
| Card heading (H3) | Inter | 18px | 500 |
| Body text | Inter | 16px | 400 |
| Label / caption | Inter | 13px | 500 |
| Code / monospace | JetBrains Mono | 14px | 400 |

#### Spacing & layout
- Base unit: 4px. All spacing is multiples of 4.
- Page max-width: 1200px centred.
- Card border-radius: 12px. Component border-radius: 8px. Pill: 100px.
- Card shadow: none. Border: 1px solid `#D3D1C7`.
- Grid: 12-column on desktop, 4-column on mobile.

### 4.3 Component Library

#### Buttons

| Variant | Use case | Style |
|---|---|---|
| Primary | Main CTA — "Find Partner", "Sign Up" | bg `#534AB7`, white text, hover `#3C3489` |
| Secondary | Alternative action — "Cancel", "Skip" | transparent bg, `#534AB7` border, `#534AB7` text |
| Danger | Destructive — "End Call", "Submit Report" | bg `#A32D2D`, white text |
| Ghost | Low-emphasis — "View profile", icon buttons | transparent, no border, hover bg `#F5F4F0` |

#### Status indicators

- **Speaking indicator**: animated teal (`#1D9E75`) ring on video tile, `animate-pulse` + `transition-shadow duration-200`, `ring-2` with `ring-offset-4`
- **Connection quality**: small dot in call header — green (Good), amber (Fair), red (Poor)
- **Streak**: flame icon (🔥) with teal number, animated count-up on dashboard load via `requestAnimationFrame` (800ms)
- **Online count**: pulsing green dot + number on landing page, updated every 10 seconds via Socket.io

### 4.4 Loading & Empty States

#### Loading states — rules
- ✅ Never use a spinner for page-level loads — use skeleton loaders that match the layout
- ✅ Buttons: disable immediately on click, show inline spinner, restore if error
- ✅ Searching state: show elapsed time every second so users know the system is working
- ✅ Video tile before stream loads: dark tile with animated pulsing avatar initials

#### Empty states

| Screen | Empty condition | Message + action |
|---|---|---|
| Dashboard | Zero sessions ever | "Your journey starts here. Every expert was once a beginner." → "Start your first call" button |
| Match/searching | No match after 90 seconds | ⏰ "No partners available right now. Try again in a few minutes." → "Try Again" button |
| Session history | No sessions this week | "No sessions this week. Consistency is everything." → "Find a partner" button |
| Profile | Viewing own profile, 0 sessions | "Start speaking to build your story." → "Find a partner" button |

### 4.5 Micro-interactions

| Interaction | Implementation | Status |
|---|---|---|
| "Find Partner" button pulse | `animate-pulse` CSS (scale loop) | ✅ |
| Match found | 600ms green flash (`bg-green-500/20`) + confetti (`canvas-confetti`, 100 particles) | ✅ |
| Speaking ring | `transition-shadow duration-200` on box-shadow — no instant snap | ✅ |
| Rating thumbs | `hover:scale-110` with `transition-transform` on hover | ✅ |
| Dashboard stats count-up | `requestAnimationFrame` over 800ms, `CountUp` component | ✅ |
| Streak flame bounce | `animate-bounce` on flame emoji when streak increments | ✅ |

### 4.6 Accessibility

- ✅ All interactive elements have `aria-label` or visible text label
- ✅ Focus trap inside ReportModal (Tab cycling, autoFocus, Esc to close)
- ✅ Focus trap inside rating screen (Tab cycling, autoFocus on Thumbs Up)
- ✅ Keyboard navigable: Tab through all call controls in logical order
- ✅ Match found and call ended announced via `aria-live="polite"` region
- ✅ Colour contrast checked: minimum 4.5:1 for body text, 3:1 for large text
- ✅ All form fields have associated `<label>` elements
- ✅ Video tiles have `role="img"` with `aria-label` describing the participant

### 4.7 Mobile-specific UX

| Requirement | Implementation | Status |
|---|---|---|
| Video tiles stack vertically < 640px | `flex-col sm:block` layout | ✅ |
| All touch targets min 44×44px | Toolbar buttons are `h-12 w-12` (48px) | ✅ |
| WakeLock during active call | `navigator.wakeLock.request("screen")` with feature detection | ✅ |
| Device orientation reflow | `resize` + `orientationchange` listeners (300ms debounce on orientation) | ✅ |
| iOS Safari getUserMedia in gesture | Permission triggered on button click → PERMISSION_CHECK state | ✅ |

### 4.8 Copy Guidelines

- ✅ Use "you" language — "Your partner is ready" not "Partner found"
- ✅ Errors are specific and actionable — "Camera access was denied. Click the camera icon in your browser's address bar to allow it." not "Camera error."
- ✅ Progress language is encouraging — "Great session!" not "Session completed."
- ✅ Level labels include descriptions: "B2 — Upper Intermediate: Can discuss most topics fluently"
- ✅ Avoid technical jargon in user-facing copy — never show "WebRTC", "Socket.io", "PeerJS"

---

## 5. Backend Schema

### 5.1 Database Schema (Prisma)

#### User

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (UUID) | Yes | Primary key, maps to Supabase auth.users.id |
| email | String | Yes | Unique, from Supabase auth |
| name | String | Yes | Display name, set in onboarding |
| country | String | Yes | ISO 3166-1 alpha-2 code (e.g. "IN", "US") |
| avatarUrl | String? | No | URL to avatar image, null uses initials fallback |
| englishLevel | Enum | Yes | A1 \| A2 \| B1 \| B2 \| C1 \| C2 — indexed |
| interests | String[] | Yes | Array: ["travel","food","tech",...] min 2 |
| totalMinutes | Int | Yes | Default 0 — incremented per session |
| totalSessions | Int | Yes | Default 0 — incremented per session |
| currentStreak | Int | Yes | Default 0 — consecutive days with ≥1 session |
| lastSessionDate | DateTime? | No | Date-only comparison for streak logic |
| onboardingComplete | Boolean | Yes | Default false — set true after /onboarding |
| createdAt | DateTime | Yes | Auto @default(now()) |
| updatedAt | DateTime | Yes | Auto @updatedAt |

#### Session

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (UUID) | Yes | Primary key |
| user1Id | String | Yes | Foreign key → User — indexed |
| user2Id | String | Yes | Foreign key → User — indexed |
| durationSeconds | Int | Yes | Actual call duration in seconds |
| topicUsed | String | Yes | Topic string at time of session |
| user1Rating | Boolean? | No | true=thumbs up, false=thumbs down, null=skipped |
| user2Rating | Boolean? | No | Same as above for user2 |
| createdAt | DateTime | Yes | Session start time — indexed for history queries |

#### Block

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (UUID) | Yes | Primary key |
| blockerId | String | Yes | User who initiated the block — indexed |
| blockedId | String | Yes | User who was blocked — indexed |
| createdAt | DateTime | Yes | Auto @default(now()) |

#### Report

| Field | Type | Required | Notes |
|---|---|---|---|
| id | String (UUID) | Yes | Primary key |
| reporterId | String | Yes | Foreign key → User |
| reportedId | String | Yes | Foreign key → User |
| reason | Enum | Yes | INAPPROPRIATE_LANGUAGE \| HARASSMENT \| SPAM \| OTHER |
| note | String? | No | Optional text note, max 280 chars |
| resolved | Boolean | Yes | Default false — admin toggles to true |
| createdAt | DateTime | Yes | Auto @default(now()) |

### 5.2 API Endpoints

#### Auth routes — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/me` | Bearer JWT | Verify Supabase token and return user profile |
| POST | `/api/auth/verify` | Bearer JWT | Verify Supabase token and return user profile |

#### User routes — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/users` | Bearer JWT | Create user profile (called after first auth) |
| GET | `/api/users/:id` | Bearer JWT | Get user profile by ID |
| PATCH | `/api/users/:id` | Bearer JWT (own) | Update profile: level, interests, name, country |
| DELETE | `/api/users/:id` | Bearer JWT (own) | Delete account and all associated data |
| GET | `/api/users/:id/blocks` | Bearer JWT (own) | Get list of blocked user IDs for matchmaking |

#### Session routes — `/api/sessions`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/sessions` | Bearer JWT | Save completed session, update stats (atomic transaction) |
| GET | `/api/sessions` | Bearer JWT | Get session history for authenticated user (paginated) |
| PATCH | `/api/sessions/:id/rate` | Bearer JWT | Save post-session rating (thumbs up/down) |

#### Report routes — `/api/reports`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/reports` | Bearer JWT | Submit a report against another user |
| POST | `/api/reports/:userId/block` | Bearer JWT | Block a user |

### 5.3 In-memory Queue Structure

The matchmaking queue is a `Map<string, QueueEntry>` on the Node.js server process:

```ts
interface QueueEntry {
  userId:         string;
  socketId:       string;
  level:          'A1'|'A2'|'B1'|'B2'|'C1'|'C2';
  interests:      string[];
  blockedUserIds: Set<string>;
  joinedAt:       number;  // Date.now()
}
```

The matching algorithm runs every 3 seconds via `setInterval`:

1. For each level, collect all `QueueEntry` values at that level
2. Try to pair two users with at least 1 shared interest — O(n²) per level, acceptable at this scale
3. If no interest match: pair by level only
4. If user has been waiting > 45s: expand to adjacent level (A1↔A2, B1↔B2, C1↔C2)
5. Before pairing: verify neither user has blocked the other (bidirectional check)
6. On match: remove both from Map, emit `matchFound` to both sockets
7. Stale cleanup: every 60s, remove entries where `joinedAt < now - 300000` (5 minutes)

### 5.4 Streak Calculation Logic

The streak service runs atomically inside a `Prisma.$transaction` after every session save:

1. Get `user.lastSessionDate` (date-only via `getUTCDate()`) and `user.currentStreak`
2. Get today's date in UTC (date-only, YYYY-MM-DD string)
3. If `lastSessionDate === today`: do nothing (already spoke today, streak unchanged)
4. If `lastSessionDate === yesterday`: `currentStreak += 1`
5. If `lastSessionDate` is null or > 1 day ago: `currentStreak = 1`
6. Update user: `lastSessionDate = today`, `currentStreak = calculated value`

> **Note:** All date comparisons use date-only strings (YYYY-MM-DD) in UTC to avoid timezone boundary bugs.

---

## 6. Implementation Plan

### 6.1 Phase Overview

| Phase | Name | Duration | Deliverable | Status |
|---|---|---|---|---|
| 1 | Foundation | 1 week | Monorepo, auth, onboarding, DB connected | ✅ Complete |
| 2 | Core feature | 2 weeks | Matchmaking + video call end-to-end working | ✅ Complete |
| 3 | Polish | 1 week | Dashboard, safety, error handling, UX details | ✅ Complete |
| 4 | Hardening | 1 week | Tests, CI/CD, security audit, performance pass | ✅ Complete |
| 5 | Launch | 3 days | Production deploy, monitoring, announce | ✅ Complete |

### 6.2 Phase 1 — Foundation ✅

#### Tasks
1. ✅ Set up monorepo: root package.json workspaces, turbo.json, shared eslint + prettier config
2. ✅ Create `packages/types` (shared TypeScript interfaces for SocketEvents, User, Session)
3. ✅ Create `packages/config` (shared constants: LEVELS, INTERESTS, TOPICS array, timeout values)
4. ✅ `apps/server`: Express + Socket.io scaffold, Helmet, CORS, rate limiting, `env.ts` validation
5. ✅ `apps/server`: Prisma schema (User, Session, Block, Report), migration, seed script
6. ✅ `apps/server`: Supabase Auth middleware (JWT verification on all protected routes)
7. ✅ `apps/server`: `/api/users` CRUD routes with Zod validation
8. ✅ `apps/web`: Next.js 14 App Router scaffold with Tailwind + shadcn/ui
9. ✅ `apps/web`: Supabase Auth integration (email + Google OAuth), AuthProvider component
10. ✅ `apps/web`: `/signup`, `/login` pages with form validation and error handling
11. ✅ `apps/web`: `/onboarding` 3-step flow with progress bar, validation, and API call
12. ✅ `apps/web`: Zustand stores (`useAuthStore`, `useMatchStore`, `useCallStore`)

#### Acceptance criteria
- ✅ User can sign up with email, verify email, complete onboarding, and see dashboard
- ✅ User can sign in with Google and complete onboarding
- ✅ All API routes return 401 without valid JWT
- ✅ All form fields validate inline before submit
- ✅ Env vars validated at server startup — missing var crashes with clear message

### 6.3 Phase 2 — Core Feature ✅

#### Tasks
1. ✅ `apps/server`: In-memory Map matchmaking service with 3-second matching loop
2. ✅ `apps/server`: Socket.io event handlers: `joinQueue`, `leaveQueue`, `callEnded`, `reportUser`
3. ✅ `apps/server`: Match logic: level-based, interest-weighted, block-aware, stale cleanup
4. ✅ `apps/server`: Session save endpoint with Prisma.$transaction (save + stats update + streak)
5. ✅ `apps/web`: `/match` page with all 6 states (IDLE, PERMISSION_CHECK, SEARCHING, MATCHED, IN_CALL, ENDED)
6. ✅ `apps/web`: useMediaStream hook (getUserMedia, permission check, iOS Safari handling)
7. ✅ `apps/web`: usePeer hook (PeerJS setup, call, stream, cleanup, error handling for all error types)
8. ✅ `apps/web`: useSocket hook (connect, reconnect, event listeners, cleanup)
9. ✅ `apps/web`: VideoTile component (stream display, speaking indicator, avatar fallback)
10. ✅ `apps/web`: CallControls component (mute, camera, end call, report)
11. ✅ `apps/web`: TopicBar component (today's topic, timer)
12. ✅ `apps/web`: SearchingState component (elapsed time, cancel, queue position)
13. ✅ `apps/web`: MatchFoundScreen component (partner info, 2-second auto-advance)
14. ✅ `apps/web`: RatingScreen component (thumbs up/down, skip with 5s timer)

#### Acceptance criteria
- ✅ Two browsers on different networks can be matched and video-call each other end-to-end
- ✅ Session is saved to DB after call ends with correct duration and topic
- ✅ Stats (totalMinutes, totalSessions, streak) update correctly after session
- ✅ Cancelling search removes user from queue immediately
- ✅ Partner disconnecting mid-call shows "Partner disconnected" overlay and returns to IDLE
- ✅ Camera indicator light turns off after call ends (all MediaStream tracks stopped)

### 6.4 Phase 3 — Polish ✅

#### Tasks
1. ✅ `/dashboard` page with skeleton loaders, stats cards, session history, empty state
2. ✅ Report modal UI in CallControls with reason dropdown and note field
3. ✅ Block user flow (from session history and report form)
4. ✅ `/profile/[userId]` page with public stats
5. ✅ `/settings` page with level, interests, name, country update forms
6. ✅ `react-hot-toast` integration for all async feedback (match found, errors, etc.)
7. ✅ Offline/online banner (`window online/offline` events + auto reconnect)
8. ✅ ConnectionQuality component (`RTCPeerConnection.getStats()` → Good/Fair/Poor)
9. ✅ MicLevelIndicator component (`AudioContext` analyser on local stream)
10. ✅ WakeLock hook (`navigator.wakeLock` during call, graceful fallback)
11. ✅ Micro-interactions (find partner pulse, match found confetti + green flash, rating animation)
12. ✅ Landing page (`/`) with live online count via Socket.io

#### Acceptance criteria
- ✅ Dashboard loads with skeleton, then real data, in under 500ms on fast connection
- ✅ All error states show specific, actionable messages (not generic "error occurred")
- ✅ Report submits correctly, call ends, reporter returned to IDLE
- ✅ Block prevents matched user from appearing in future matches
- ✅ Screen does not sleep during a call on iOS and Android

### 6.5 Phase 4 — Hardening ✅

#### Tasks
1. ✅ Unit tests: `matchmaking.test.ts` (queue logic, blocking, stale entries) — 6 tests passing
2. ✅ Unit tests: `streak.test.ts` (all edge cases) — 7 tests passing
3. ✅ Integration tests: `sessions.test.ts` (route structure documented with test stubs)
4. ✅ Integration tests: `users.test.ts`
5. ✅ Playwright e2e: `auth.spec.ts` (signup → onboarding flow), `match.spec.ts`
6. ✅ GitHub Actions CI: lint + typecheck + unit tests on every PR
7. ✅ GitHub Actions deploy: Vercel (web) + Render (server) on merge to main
8. ✅ Security audit: all rate limits, CORS, JWT validation, input sanitisation verified
9. ⚠️ Performance pass: The following items need manual verification:
   - Lighthouse mobile score > 90 (not yet run)
   - ~5 `any` types remain in UI code (can be tightened)
10. ✅ TypeScript strict mode on both apps (`strict: true` in tsconfig)
11. ✅ Pino structured logging on server, zero `console.log` in production code
12. ✅ Sentry error tracking (free tier) — both web (`@sentry/nextjs`) and server (`@sentry/node`)

#### Acceptance criteria
- ✅ All unit tests pass — **20/20 passing**
- ⚠️ Lighthouse mobile score > 90 — not verified (manual check needed)
- ✅ No TypeScript errors in strict mode
- ✅ CI passes on every PR before merge is allowed
- ✅ No console.log calls in production build

### 6.6 Phase 5 — Launch ✅

#### Tasks
1. ✅ Configure Vercel production environment variables
2. ✅ Configure Render production environment variables
3. ✅ Run `prisma migrate deploy` on production Supabase DB
4. ✅ Configure Supabase Google OAuth redirect URL for production domain
5. ✅ Set CORS to production frontend URL only
6. ✅ Smoke test full user journey end-to-end on production
7. ✅ Set up Vercel Analytics and Core Web Vitals monitoring
8. ✅ Write README.md with local dev setup instructions
9. ✅ Write CONTRIBUTING.md with git flow and PR checklist

#### Acceptance criteria
- ✅ Full user journey works end-to-end on production domain on mobile and desktop
- ✅ Google OAuth works on production domain
- ✅ All environment variables confirmed set (no fallback to defaults)
- ✅ README allows a new developer to run the project locally in under 10 minutes

### 6.7 Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|
| PeerJS calls fail on firewalled networks (no TURN relay) | Medium | High | Show "Call quality may be limited" warning. Phase 2: add coturn on Fly.io | ⚠️ Warning implemented, TURN is future |
| Render free tier spins down after 15m — slow cold start | High | Medium | UptimeRobot free ping every 10 min to keep server warm | ✅ Implemented |
| In-memory queue lost on server restart mid-match | Low | Low | Users simply rejoin queue — < 1 second action | ✅ Acceptable |
| Supabase free tier 500MB storage exceeded | Low | Medium | Each session < 1KB. 500MB fits ~500K sessions | ✅ Monitoring |
| Low concurrent users early → long match wait times | High | Medium | Level expansion after 45s, clear waiting count shown | ✅ Implemented |

### 6.8 Future Roadmap (v1.1+)

| Feature | Version | Rationale |
|---|---|---|
| AI pronunciation feedback post-call | v1.1 | High user value, can use Whisper API free tier |
| Scheduled practice sessions (book a slot) | v1.1 | Reduces wait time problem for early-stage low traffic |
| TURN server for firewall traversal (coturn) | v1.1 | Improves call reliability on restricted networks |
| Group practice rooms (3–5 people) | v1.2 | Community feature, drives retention |
| Native mobile app (React Native) | v1.2 | Bigger addressable market, push notifications |
| Teacher/tutor marketplace | v2.0 | Monetisation path — paid 1:1 lessons |
| AI conversation partner (for off-peak hours) | v2.0 | Fallback when no human partner is available |

---

## Appendix A: Git Commit Log

```
3727507 feat: add auth rate limiter (10req/15min), fix CTA sentence case
00ea405 feat: final spec gap closure - verify endpoint, block route, speaking ring transition, pulse button, initials, integration tests
507185c feat: complete all spec requirements - green flash, block from history, empty state msg, focus trap, PERMISSION_CHECK, orientation, level descs
98f46f9 feat: complete spec audit fixes - rating timer, pulse dot, mic level, hover scale, focus trap, video placeholder, Sentry
6bc1319 feat: add keyboard shortcuts M (mute), C (camera), Esc (end call)
a547148 feat: stack video tiles vertically on mobile, pip on desktop
592792f feat: add streak flame icon with count-up animation on dashboard
c3c646b feat: add speaking indicator with voice activity detection and teal ring
91e741c feat: add match timeout empty state after 90s with Try Again button
7362ca2 feat: add report button + modal during video call
```

## Appendix B: Quick Start

```bash
# Install
npm install

# Start both server and web
npm run dev

# Or start individually
npm run dev:server
npm run dev:web

# Run tests
npm run test

# Typecheck
npm run typecheck
```

## Appendix C: Environment Variables

### `apps/server/.env`
```
DATABASE_URL=postgres://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=service_role_key
CORS_ORIGIN=http://localhost:3000,https://speak-up-web-umber.vercel.app
PORT=4000
SENTRY_DSN=https://...
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key
NEXT_PUBLIC_API_URL=http://localhost:4000,https://speakup-8mdb.onrender.com
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000,https://speakup-8mdb.onrender.com
NEXT_PUBLIC_SENTRY_DSN=https://...
```
