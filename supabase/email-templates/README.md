# Supabase Auth email templates

The app signs in with a **6-digit code** (`signInWithOtp` then
`verifyOtp({ type: "email" })`, see `src/app/login/page.tsx`).

The key point: **Supabase always sends the same token**, whatever the method.
What decides whether the parent receives a _link_ or a _code_ is the template
content alone. The default templates only expose `{{ .ConfirmationURL }}` — hence
the magic link people get until you fix them. No application-code change can make
up for it.

## Where to paste these files

Supabase dashboard → **Authentication › Emails** (_Templates_ tab).

| File                  | Template to replace | Sent when                                                     |
| --------------------- | ------------------- | ------------------------------------------------------------- |
| `confirm-signup.html` | **Confirm signup**  | the address **does not exist yet** → a parent's first sign-in |
| `magic-link.html`     | **Magic Link**      | the address **already exists** → a returning parent           |

⚠️ **Both are required.** `signInWithOtp` creates the account on the fly
(`shouldCreateUser` defaults to `true`): fixing only _Magic Link_ would leave
every new signup — so every parent arriving from the landing page — receiving a
link.

Also align the email subject, for example
« Votre code de connexion Petite Cuillère ».

## Related settings

Under **Authentication › Sign In / Providers › Email**:

- _Email OTP Length_ — must be **6** (the form input validates automatically on
  the 6th keystroke).
- _Email OTP Expiration_ — 3600 s by default; the email copy says « une heure »,
  so realign it if you change the value.

## The domain is hard-coded

Both templates point at `https://petite-cuillere.fr` (brand name in the header,
domain in the footer). They live in the Supabase dashboard, outside the Next.js
build: `NEXT_PUBLIC_SITE_URL` does not reach them. **On a domain change these
files must be edited and pasted back by hand** (see `docs/deploiement.md`).

Not to be confused with `{{ .ConfirmationURL }}`, which Supabase builds from the
_Site URL_ and which therefore follows automatically.

## What these templates do

The code is the main element; the link stays available at the bottom for whoever
prefers to click (the `/auth/callback` route still works). Table-based layout and
inline styles — the only thing mail clients reliably honour — with no remote
images, and design-system colours converted to hexadecimal since `oklch()` is not
supported there.
