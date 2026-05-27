# SpeakUp Server

Express + Socket.IO backend for video call matchmaking.

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/me` | JWT | Returns current user profile |
| POST | `/api/sessions` | JWT | Create a session after call |
| GET | `/api/sessions/:userId` | JWT | List user sessions |
| PUT | `/api/sessions/:roomId/rating` | JWT | Rate a session |
| GET | `/api/users/:id` | JWT | Get user profile |
| PUT | `/api/users/:id` | JWT | Update own profile |
| POST | `/api/reports` | JWT | Report a user |
| POST | `/api/reports/block` | JWT | Block a user |
| GET | `/api/health` | — | Health check |

## Socket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `getOnlineCount` | — | Request active user count |
| `joinQueue` | `{ userId, level, interests }` | Enter matchmaking |
| `leaveQueue` | — | Leave matchmaking |
| `callEnded` | `{ roomId?, partnerUserId? }` | Notify partner call ended |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `onlineCount` | `{ count }` | Active user count |
| `queuePosition` | `{ waitingCount }` | Queue size update |
| `matchFound` | `{ partner, roomId, isCaller, topic }` | Match ready |
| `partnerLeft` | — | Partner disconnected |

## Matchmaking

- In-memory Map-based queues per English level
- Interest-based matching first 20s, then expands to adjacent levels after 45s
- Stale entries cleaned every 3s (5 min TTL)
