# SpeakUp Web

Next.js 14 frontend for video call English practice.

## Pages

| Route | Auth | Description |
|-------|------|-------------|
| `/` | No | Landing page with online count |
| `/login` | No | Login form |
| `/signup` | No | Registration form |
| `/onboarding` | Yes | Set level and interests |
| `/dashboard` | Yes | Stats and history |
| `/match` | Yes | Queue join, video call, rating |

## Stores (Zustand)

| Store | Key State | Description |
|-------|-----------|-------------|
| `useAuthStore` | user, profile, loading | Current auth state |
| `useMatchStore` | state, partner, isCaller | Match lifecycle |
| `useCallStore` | isMuted, isCameraOff, duration | Call controls |

## Key Components

| Component | Purpose |
|-----------|---------|
| `AuthProvider` | Session init + profile fetch + auto-create |
| `VideoCall` | PeerJS WebRTC with WakeLock, quality indicator |
| `Navbar` | Navigation with auth state |

## Hooks

| Hook | Purpose |
|------|---------|
| `useSocket` | Typed socket.io events with cleanup |
| `usePeer` | PeerJS lifecycle management |
| `useMediaStream` | getUserMedia with permission handling |
| `useWakeLock` | Screen wake lock during calls |
