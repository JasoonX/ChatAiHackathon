# Password Reset (Mock SMTP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add password reset flow that shows the reset link directly on the page instead of sending email (mock SMTP for hackathon demo).

**Architecture:** better-auth has built-in `forgetPassword` / `resetPassword` endpoints. We enable them by adding a `sendResetPassword` callback in the server config. Instead of sending email, the callback returns the reset URL to the client via a custom API wrapper. Two new pages: `/forgot-password` (enter email, get link displayed) and `/reset-password` (enter new password with token from URL).

**Tech Stack:** better-auth emailAndPassword config, Next.js pages, existing shadcn/ui components, authClient.

---

### Task 1: Enable password reset in better-auth server config

**Files:**
- Modify: `src/lib/auth.ts`

**Step 1: Add `sendResetPassword` to the `emailAndPassword` config**

In `src/lib/auth.ts`, update the `emailAndPassword` block:

```typescript
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url, token }) => {
    // Mock SMTP: log to console instead of sending email
    console.log(`[MOCK SMTP] Password reset for ${user.email}: ${url}`);
  },
},
```

This enables the `/api/auth/forget-password` and `/api/auth/reset-password` endpoints that better-auth provides.

**Step 2: Verify the dev server starts without errors**

Run: `pnpm dev` (check for startup errors, then stop)

**Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: enable password reset in better-auth config with mock SMTP"
```

---

### Task 2: Create the forgot-password page

**Files:**
- Create: `src/app/forgot-password/page.tsx`
- Modify: `middleware.ts` (add `/forgot-password` to public routes)

**Step 1: Add `/forgot-password` to middleware public routes**

In `middleware.ts`, update:

```typescript
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];
```

And update the matcher:

```typescript
export const config = {
  matcher: [
    "/chat/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
```

**Step 2: Create the forgot-password page**

Create `src/app/forgot-password/page.tsx`. The flow:

1. User enters their email
2. We call `authClient.forgetPassword({ email, redirectTo: "/reset-password" })`
3. better-auth generates the token, calls our `sendResetPassword` callback (console.log)
4. better-auth also hits `/api/auth/reset-password/:token?callbackURL=/reset-password` which redirects to `/reset-password?token=<token>`
5. BUT since we're mocking — we need a different approach. The `sendResetPassword` callback receives the `url`. We need to surface that URL to the user on the page.

**Revised approach:** Since `sendResetPassword` runs server-side and the client only gets `{ status: true }`, we can't directly return the URL to the client. Instead:

- Create a custom API route `/api/auth/mock-reset` that:
  1. Looks up the user by email
  2. Creates a verification token (same as better-auth does)
  3. Returns the reset URL in the response body

Actually, simpler: we use a **server-side variable** to capture the URL. The `sendResetPassword` callback stores the URL in a module-scoped Map keyed by email. Then we expose a small API route that the forgot-password page polls right after submitting. 

**Even simpler:** Just build a custom `/api/forgot-password` route that does the token generation directly using the `verifications` table, bypassing better-auth's email flow entirely. This avoids the indirection.

**Simplest approach chosen:** Use better-auth's client `forgetPassword()` call, but intercept the URL server-side and expose it via a temporary in-memory store + a dedicated API route.

Here's the final design:

1. `sendResetPassword` callback stores `{ email -> url }` in a module-level `Map` with TTL
2. Custom API route `GET /api/auth/mock-reset-url?email=...` returns the stored URL and deletes it
3. Forgot-password page: submit email → call forgetPassword → immediately fetch mock-reset-url → display the link

**Step 2a: Add the in-memory store to auth.ts**

In `src/lib/auth.ts`, add before the `auth` export:

```typescript
// Mock SMTP: store reset URLs in memory so the UI can display them
const resetUrlStore = new Map<string, { url: string; expires: number }>();

export function consumeResetUrl(email: string): string | null {
  const entry = resetUrlStore.get(email);
  if (!entry || Date.now() > entry.expires) {
    resetUrlStore.delete(email);
    return null;
  }
  resetUrlStore.delete(email);
  return entry.url;
}
```

And update `sendResetPassword`:

```typescript
sendResetPassword: async ({ user, url }) => {
  console.log(`[MOCK SMTP] Password reset for ${user.email}: ${url}`);
  resetUrlStore.set(user.email, { url, expires: Date.now() + 5 * 60 * 1000 });
},
```

**Step 2b: Create the mock-reset-url API route**

Create `src/app/api/auth/mock-reset-url/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { consumeResetUrl } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  const url = consumeResetUrl(email);
  if (!url) {
    return NextResponse.json({ error: "No reset URL found" }, { status: 404 });
  }
  return NextResponse.json({ url });
}
```

**Step 2c: Create the forgot-password page**

Create `src/app/forgot-password/page.tsx`:

- Card layout matching login/register pages
- Email input field
- Submit button that:
  1. Calls `authClient.forgetPassword({ email, redirectTo: "/reset-password" })`
  2. Then fetches `/api/auth/mock-reset-url?email=...`
  3. Displays the reset URL as a clickable link with a note: "In production, this link would be sent to your email."
- Back to login link

Use the same Card/Input/Button/Label components as the login page. Match the existing auth page styling exactly.

**Step 3: Commit**

```bash
git add middleware.ts src/app/forgot-password/page.tsx src/lib/auth.ts src/app/api/auth/mock-reset-url/route.ts
git commit -m "feat: add forgot-password page with mock SMTP link display"
```

---

### Task 3: Create the reset-password page

**Files:**
- Create: `src/app/reset-password/page.tsx`

**Step 1: Create the reset-password page**

Create `src/app/reset-password/page.tsx`:

- Reads `token` from the URL search params (either from `?token=...` query param)
- If no token: show error message with link back to forgot-password
- If token present: show form with:
  - New password field
  - Confirm password field
  - Submit button
- On submit: call `authClient.resetPassword({ newPassword, token })`
- On success: show success toast, redirect to `/login`
- On error: show error toast

Use the same Card layout as login/register. Same styling.

**Step 2: Verify the full flow manually**

1. Go to `/login` → click "Forgot password?" 
2. Enter a seeded user's email (e.g. alice@example.com)
3. See the reset link displayed on the page
4. Click the link → lands on `/reset-password?token=...`
5. Enter new password + confirm
6. Submit → redirected to login
7. Login with new password → success

**Step 3: Commit**

```bash
git add src/app/reset-password/page.tsx
git commit -m "feat: add reset-password page with token-based password update"
```

---

### Task 4: Add "Forgot password?" link to login page

**Files:**
- Modify: `src/app/login/page.tsx`

**Step 1: Add the forgot password link**

In `src/app/login/page.tsx`, add a "Forgot password?" link below the password field, above the submit button. Use the same `text-info hover:underline underline-offset-4` styling as the Register link:

```tsx
<div className="flex items-center justify-between">
  <label htmlFor="remember" className="...">
    ...Keep me signed in...
  </label>
  <Link
    href="/forgot-password"
    className="text-sm text-info hover:underline underline-offset-4"
  >
    Forgot password?
  </Link>
</div>
```

**Step 2: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add forgot password link to login page"
```

---

## Summary of changes

| File | Action |
|------|--------|
| `src/lib/auth.ts` | Add `sendResetPassword` callback + in-memory URL store |
| `src/app/api/auth/mock-reset-url/route.ts` | New API route to retrieve mock reset URL |
| `src/app/forgot-password/page.tsx` | New page: enter email, display reset link |
| `src/app/reset-password/page.tsx` | New page: enter new password with token |
| `src/app/login/page.tsx` | Add "Forgot password?" link |
| `middleware.ts` | Add new routes to public routes + matcher |
