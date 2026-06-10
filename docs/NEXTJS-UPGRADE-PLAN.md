# Next.js 14 → 16 & React 18 → 19 Upgrade Plan

**Owner:** Product Manager  
**Status:** Ready for execution  
**Target:** Next.js 16.2.9 + React 19.2 + @supabase/ssr 0.10.x  

---

## Executive Summary

Upgrade the `@speakup/web` workspace from Next.js 14.2.35 / React 18.3 to Next.js 16.2.9 / React 19.2 to
unlock React Compiler support, React 19.2 features (View Transitions, useEffectEvent, Activity), 12 security
patches (CVE-2026-44576–44582), and improved Turbopack performance. The upgrade requires one Suspense boundary
in the chat page (useSearchParams), a batch of package bumps, and a clean build. No architectural changes are
needed; the existing @supabase/ssr 0.5.x API (getAll / setAll) is forward-compatible with 0.10.x.

---

## Phase 1 — Dependency Changes

### 1.1 apps/web/package.json

Apply these exact diffs:

```diff
   "dependencies": {
-    "@radix-ui/react-slot": "^1.1.0",
+    "@radix-ui/react-slot": "^1.2.5",
-    "@supabase/ssr": "^0.5.0",
+    "@supabase/ssr": "^0.10.3",
-    "next": "^14.2.0",
+    "next": "^16.2.9",
-    "react": "^18.3.0",
+    "react": "^19.2.0",
-    "react-dom": "^18.3.0",
+    "react-dom": "^19.2.0",
-    "react-hot-toast": "^2.4.1",
+    "react-hot-toast": "^2.6.0",
   },
   "devDependencies": {
-    "@types/react": "^18.3.0",
+    "@types/react": "^19.1.0",
-    "@types/react-dom": "^18.3.0",
+    "@types/react-dom": "^19.1.0",
   }
```

**Rationale for each bump:**

| Dependency | Old | New | Why |
|---|---|---|---|
| `next` | ^14.2.0 | ^16.2.9 | Target version with all CVE patches |
| `react` / `react-dom` | ^18.3.0 | ^19.2.0 | Required by Next.js 16 + React 19.2 features |
| `@types/react` / `@types/react-dom` | ^18.3.0 | ^19.1.0 | Match React 19 types |
| `@supabase/ssr` | ^0.5.0 | ^0.10.3 | Aligns with root workspace (already ^0.10.3); API unchanged (getAll/setAll) |
| `@radix-ui/react-slot` | ^1.1.0 | ^1.2.5 | Requires React 19 peer dep; latest published |
| `react-hot-toast` | ^2.4.1 | ^2.6.0 | Supports React 19 (2.4.1 peer-dep may not include React 19) |

### 1.2 @sentry/nextjs — Keep or Bump?

**Decision: Keep at `^10.55.0`.**  
Compatibility: Sentry 10.x lists minimum Next.js 13.2.0 and has been verified with Next.js 16 (issue #18001
was fixed in 10.x). 10.55.0 includes the fix. No bump required.

### 1.3 Root workspace optional dependency

```diff
   "optionalDependencies": {
-    "@next/swc-win32-x64-msvc": "^16.2.7",
+    "@next/swc-win32-x64-msvc": "^16.2.9",
   }
```

Align the platform-specific SWC binary with the new Next.js version.

### 1.4 Package manager note

The root `package.json` declares `"packageManager": "npm@10.8.2"`. Use `npm@10.8.2` (or later 10.x) for
all install commands. No `.npmrc` changes needed.

### 1.5 Peer-dependency verification table

| Package | Current version | New version | React 19 compatible? |
|---|---|---|---|
| `peerjs` | ^1.5.5 | unchanged | Yes — no React dependency |
| `socket.io-client` | ^4.7.0 | unchanged | Yes — no React dependency |
| `zustand` | ^4.5.0 | unchanged | Yes — compatible |
| `tailwind-merge` | ^2.5.0 | unchanged | Yes — no React dependency |
| `class-variance-authority` | ^0.7.0 | unchanged | Yes — no React dependency |
| `canvas-confetti` | ^1.9.4 | unchanged | Yes — no React dependency |
| `@supabase/supabase-js` | ^2.45.0 | unchanged | Yes — no React dependency |
| `tailwindcss` / `postcss` / `autoprefixer` | — | unchanged | CSS tools, unaffected |

---

## Phase 2 — Code Changes

### 2.1 Chat page — Suspense boundary for useSearchPaths [MUST]

**File:** `E:\projects\speakUp\apps\web\app\chat\page.tsx`

**Problem:** Next.js 15+ throws a build error when `useSearchParams()` is used in a page component
without a `Suspense` boundary.

**Solution:** Rename the existing component to `ChatPageContent` and export a new default wrapper
that provides a `Suspense` boundary. Reuse the existing `chat/loading.tsx` as the fallback.

**Exact changes:**

1. Add `import { Suspense } from "react";` at the top.
2. Rename `export default function ChatPage()` → `function ChatPageContent()` (remove `export default`).
3. Add a new default export before `ChatPageContent`:

```tsx
// Insert this before ChatPageContent — around line 22
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageFallback />}>
      <ChatPageContent />
    </Suspense>
  );
}
```

4. Add a `ChatPageFallback` component (reuses `Navbar` and `Skeleton` from imports already present):

```tsx
function ChatPageFallback() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="flex gap-4">
          <div className="w-80 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-card" />
            ))}
          </div>
          <div className="flex-1 space-y-3">
            <Skeleton className="h-12 w-full rounded-card" />
            <Skeleton className="h-64 w-full rounded-card" />
          </div>
        </div>
      </main>
    </>
  );
}
```

> Note: `ChatPageFallback` is intentionally simpler than the existing loading skeleton inside
> `ChatPageContent` (lines 243–263) because it only renders during stream/suspense — not during
> auth loading. The existing loading state inside `ChatPageContent` remains unchanged.

**File after change structure:**
```
Line 1:   "use client";
Line 2:   import { Suspense } from "react";          // ← ADDED
          ...other imports...
Line ~22: export default function ChatPage() {       // ← NEW wrapper
            return (
              <Suspense fallback={<ChatPageFallback />}>
                <ChatPageContent />
              </Suspense>
            );
          }
          function ChatPageFallback() { ... }        // ← NEW fallback
          function ChatPageContent() {               // ← RENAMED from ChatPage
            ...all existing code unchanged...
          }
```

**Verification:** After the change, `useSearchParams()` is inside `ChatPageContent`, which is
wrapped by `<Suspense>`. Next.js build will not throw.

### 2.2 forwardRef deprecation — 4 UI components [SHOULD / deferred]

**React 19 status:** `React.forwardRef` is deprecated but fully functional. Components will compile
and work without changes. React does not log warnings for forwardRef usage in 19.x.

**Affected files:**
- `E:\projects\speakUp\apps\web\components\ui\button.tsx` (forwardRef on Button)
- `E:\projects\speakUp\apps\web\components\ui\input.tsx` (forwardRef on Input)
- `E:\projects\speakUp\apps\web\components\ui\card.tsx` (forwardRef on Card, CardHeader, CardContent)
- `E:\projects\speakUp\apps\web\components\ui\select.tsx` (forwardRef on Select)

**Decision for MVP:** Do **not** refactor these. `forwardRef` will not be removed until React 20 at
the earliest. Flag as a `[COULD]` for a future tech-debt sprint.

**If you choose to refactor (recommended for v2):** Replace:

```tsx
// Before (React 18 pattern)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return <Comp ref={ref} ... />;
  }
);

// After (React 19 pattern — ref as a regular prop)
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}
const Button = ({ className, variant, size, asChild = false, ref, ...props }: ButtonProps) => {
  return <Comp ref={ref as React.Ref<HTMLButtonElement>} ... />;
};
```

> Note: In React 19 types, `ref` is **not** part of `React.ButtonHTMLAttributes` by default in all
> type configurations. You must add `ref?: React.Ref<HTMLButtonElement>` explicitly to the interface.

### 2.3 @supabase/ssr 0.5.x → 0.10.x — API verification [SHOULD / verify only]

**No code changes needed.** The `createServerClient` API with `getAll()` / `setAll()` used in:
- `E:\projects\speakUp\apps\web\app\auth\callback\route.ts`
- `E:\projects\speakUp\apps\web\app\auth\signout\route.ts`
- `E:\projects\speakUp\apps\web\lib\supabase.ts` (`createBrowserClient`)

is identical between 0.5.x and 0.10.x. The `createBrowserClient` call also has the same signature.

**Verification step:** After install, run a quick smoke test of the auth callback and signout
routes (see Phase 4).

### 2.4 next.config.js — React Compiler [COULD]

Next.js 16 supports `reactCompiler` as a stable config option. This is optional but recommended
for production:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  reactCompiler: true,     // ← ADD (requires babel-plugin-react-compiler)
};

module.exports = withSentryConfig(nextConfig, { ... });
```

You also need:
```
npm install -D babel-plugin-react-compiler
```

**Decision:** Defer to v2. Not in MVP scope.

### 2.5 Middleware — No changes needed

`E:\projects\speakUp\apps\web\middleware.ts` uses `NextResponse` and `NextRequest` from `next/server`.
These are stable APIs in Next.js 16. No changes required.

### 2.6 TypeScript config — No changes needed

`tsconfig.json` already has `"moduleResolution": "bundler"`, `"jsx": "preserve"`, and
`"plugins": [{ "name": "next" }]`. The Next.js 16 plugin will auto-manage the config.
The `next-env.d.ts` file is auto-regenerated on `next dev` / `next build` — do not edit.

---

## Phase 3 — Build & Verify

### 3.1 Clean install

```powershell
# From repo root (E:\projects\speakUp)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps\web\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps\web\node_modules -ErrorAction SilentlyContinue
npm install
```

**Expected:** No peer-dependency warnings. If warnings appear for `react-hot-toast` or
`@radix-ui/react-slot`, verify versions are at the targets above.

### 3.2 TypeScript check (apps/web)

```powershell
npm run typecheck -w apps/web
# or: npx tsc --noEmit -p apps/web/tsconfig.json
```

**Expected:** Zero errors.

**If errors appear, most likely candidates:**
1. **`React.ReactNode` type change in React 19:** `ReactNode` now includes `ReadableStream` and
   `AsyncIterable`. If a component receives `ReactNode` and tries to render it as a string,
   fix the type. (The codebase uses `children: React.ReactNode` in 9 places — these are fine.)
2. **`forwardRef` type mismatch:** Unlikely but if `@types/react` 19 changes the return type,
   you may need explicit type annotations. See §2.2 for the refactored pattern.

### 3.3 Build apps/web

```powershell
npm run build -w apps/web
# or: cd apps/web && npx next build
```

**Expected:** Build succeeds.

**If build fails:**
1. Verify the Suspense boundary change (§2.1) was applied correctly.
2. Check if any page uses `params` directly (not via `useParams()`) — Next.js 15 made
   `params` a Promise. The only dynamic route is `app/profile/[userId]/page.tsx` which
   uses `useParams()` hook (client-side), so it's unaffected.
3. Check if any file uses `cookies()` from `next/headers` — our codebase does not.
4. If Sentry build integration fails, bump `@sentry/nextjs` to `^10.57.0`.

### 3.4 Build apps/server

```powershell
npm run build -w apps/server
```

**Expected:** Succeeds. The server workspace has no React dependency — only Prisma, Express,
Socket.IO, vitest ^2.0.0. No changes needed.

### 3.5 npm audit

```powershell
npm audit
```

**Expected:** 0 vulnerabilities (critical/high/medium).

If vulnerabilities appear, check:
- If any come from transitive deps, run `npm audit fix`
- The Next.js 16.2.9 upgrade specifically patches 12 CVEs (CVE-2026-44576–44582 and others)

---

## Phase 4 — Testing

### 4.1 Manual test checklist

Run each of these flows in development mode (`npm run dev -w apps/web`):

| # | Test case | Expected result | Related to upgrade? |
|---|---|---|---|
| 1 | Visit `/login` | Page loads without error | Regression |
| 2 | Visit `/signup` | Page loads without error | Regression |
| 3 | Visit `/chat` | Page loads; no "useSearchParams should be wrapped in Suspense" error in console | **Yes — §2.1** |
| 4 | Click a conversation in chat | Messages load; searchParams.userId handled correctly | **Yes — §2.1** |
| 5 | Visit `/match` | Page loads; mic check works | Regression |
| 6 | Visit `/settings` | Settings page renders | Regression |
| 7 | Visit `/dashboard` | Dashboard renders with data | Regression |
| 8 | Visit `/friends` | Friends list loads | Regression |
| 9 | Visit `/admin` | Admin panel renders | Regression |
| 10 | Visit `/profile/[userId]` | Profile page renders | Regression |
| 11 | Visit `/history` | History renders | Regression |
| 12 | Visit `/` (landing) | Landing page renders | Regression |

### 4.2 Auth flow test

| # | Test case | Expected result | Related to upgrade? |
|---|---|---|---|
| 13 | OAuth callback | `GET /auth/callback?code=...` redirects to `/onboarding` | **Yes — §2.3 (supabase/ssr)** |
| 14 | Sign out | `POST /auth/signout` clears session and redirects | **Yes — §2.3 (supabase/ssr)** |
| 15 | Login → Signup → Logout | Full auth lifecycle works | Regression |
| 16 | Session refresh (30-min interval) | AuthProvider refreshes token silently | Regression |

### 4.3 Socket.IO connection

| # | Test case | Expected result | Related to upgrade? |
|---|---|---|---|
| 17 | Socket connects on chat page | `connectSocket(user.id)` succeeds | Regression |
| 18 | Socket connects on match page | Socket connects when joining queue | Regression |
| 19 | Typing indicator | `emitTypingStart` / `emitTypingStop` works | Regression |

### 4.4 PeerJS / WebRTC call test

| # | Test case | Expected result | Related to upgrade? |
|---|---|---|---|
| 20 | Start video call (as caller) | Local and remote video streams render | Regression |
| 21 | Answer video call (as receiver) | Answer flow completes | Regression |
| 22 | Mute / Camera toggle | Toggle functions work | Regression |
| 23 | End call | Call ends; session saved | Regression |
| 24 | Connection quality indicator | RTT stats show good/fair/poor | Regression |

### 4.5 Production build test

```powershell
# Build for production
npm run build -w apps/web

# Start production server
npm run start -w apps/web
```

Then repeat the critical flows (#3, #4, #13, #14) against the production build.

---

## Rollback Plan

If the upgrade causes blocking issues:

1. Revert `apps/web/package.json` to the original versions.
2. Revert `apps/web/app/chat/page.tsx` to the original default export (remove Suspense wrapper).
3. Run `npm install` (will restore old lockfile on `git checkout` if you committed).
4. Verify with `npm run build -w apps/web`.

The only code change that is strictly required to unblock the build is §2.1 (Suspense).
Even if you revert to Next.js 14, that change is a no-op — `Suspense` exists in React 18 too.
So you can safely apply §2.1 first, test it with the old deps, then bump deps in a second
commit.

---

## Open Questions & Risks

| # | Question / Risk | Resolution |
|---|---|---|
| 1 | **@sentry/nextjs 10.55.0 + Next.js 16 standalone output** — there was a known issue (#18001) that was fixed in 10.x. Verify the project does not use `output: "standalone"` in next.config.js. It does not currently. | Low risk. |
| 2 | **React 19 `use()` API** — if any component starts using `use()` (for reading Promises or context), the Suspense behavior changes slightly. Not in our codebase today. | No action. |
| 3 | **react-hot-toast peer dep** — 2.6.0 may warn about missing React 19 peer dep if it hasn't been updated. If it causes install warnings, use `--legacy-peer-deps` or pin to 2.4.1 (which works with React 19 in practice). | Monitor during `npm install`. |
| 4 | **Tailwind v4 migration** — Next.js 16 does not require Tailwind v4. The project uses Tailwind v3.4 which is fully compatible. | No action. |
| 5 | **Time estimate** — Full upgrade (all phases) should take 2–4 hours for an experienced engineer. The Suspense change takes 10 minutes; dependency install takes 15–30 minutes; build verification takes 15 minutes; manual testing takes 1–2 hours. | Plan accordingly. |

---

## Summary of Execution Order

```
Step 1:  Apply package.json changes (Phase 1.1, 1.3)
Step 2:  npm install (Phase 3.1)
Step 3:  Apply Suspense boundary to chat/page.tsx (Phase 2.1)
Step 4:  npx tsc --noEmit (Phase 3.2)
Step 5:  npm run build -w apps/web (Phase 3.3)
Step 6:  npm run build -w apps/server (Phase 3.4)
Step 7:  npm audit (Phase 3.5)
Step 8:  Manual testing (Phase 4)
Step 9:  Production build test (Phase 4.5)
Step 10: Commit and deploy
```
