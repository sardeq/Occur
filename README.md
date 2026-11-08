# Occur

**How many times, and when?** — a one‑tap life counter for iPhone.

Make a bubble for anything you want to count (coffee, cigarettes, headaches, push‑ups…). Tap it when it happens. Occur records the exact time (and, if you want, where), shows you patterns, and answers questions like *“How many times did I smoke in the last 30 days?”* or *“When do I drink coffee the most?”*

*Click. Click. Done.*

![Occur screens](docs/screenshots/overview.jpg)

> Screens above are from the web preview of the built‑in demo mode; the app targets iOS.

---

## Quick start

```bash
npm install
cp .env.example .env            # add your Firebase + Google client IDs (or leave empty for demo mode)
npx expo start                  # press i for the iOS simulator, or scan the QR code with Expo Go
```

The demo runs in Expo Go (SDK 58). **Google sign‑in uses the native Google SDK, so it needs a development build** (`npx expo run:ios`, or `npx eas-cli@latest build --profile development`); in Expo Go the sign‑in button explains this.
`npm test` runs the query-engine tests, `npm run typecheck` and `npm run lint` check the code.

**No backend yet?** Tap **Try it without an account** (always available, even with Firebase configured): the app runs fully on the device with four months of realistic sample data — no sign-in, no network — so every screen (and the Ask feature, via the on-device parser) can be tried immediately.

### Backend setup (Firebase, free Spark plan, ~15 minutes)

1. **Create a project** in the [Firebase console](https://console.firebase.google.com) and add a **Web app** (*Project settings → General → Your apps*). Copy `apiKey`, `authDomain`, `projectId` and `appId` into the `EXPO_PUBLIC_FIREBASE_*` keys in `.env`.
2. **Firestore:** *Build → Firestore Database → Create database* (production mode). Deploy the security rules, either by pasting `firebase/firestore.rules` into *Firestore → Rules*, or:
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore --project <project-id>
   ```
   No composite indexes are needed.
3. **Google sign‑in**
   - Firebase → *Authentication → Sign-in method → Google*: enable. This creates a **Web** OAuth client; copy its client ID (Google Cloud Console → *APIs & Services → Credentials*, “Web client (auto created by Google Service)”) into `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - Same *Credentials* page → *Create credentials → OAuth client ID* → **iOS**, bundle ID `com.delv.occur`. Put its client ID in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; `app.config.ts` turns it into the iOS URL scheme the native SDK needs.
   - Android: create an **Android** OAuth client for `com.delv.occur` with your build’s SHA‑1 (`npx eas-cli@latest credentials` shows it). No client ID goes in the app for Android.
   - Rebuild the development build after changing these (`npx expo prebuild --clean` if you build locally).
4. **AI questions (OpenRouter, still on Supabase):** Firebase Cloud Functions need the paid Blaze plan, so the `ask` function stays a Supabase Edge Function. It verifies the caller’s **Firebase** ID token, so Supabase is only used to host it. Create a key at [openrouter.ai](https://openrouter.ai/keys), put the Supabase project URL + publishable key in `.env`, then deploy:
   - **Dashboard (no CLI):** *Edge Functions → Deploy a new function → Via editor*, name it `ask`, paste `supabase/functions/ask/index.ts`, **turn off “Verify JWT”**, deploy. Then *Edge Functions → Secrets* → add `OPENROUTER_API_KEY` and `FIREBASE_PROJECT_ID`.
   - **CLI:**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-ref>
     npx supabase secrets set OPENROUTER_API_KEY=sk-or-... FIREBASE_PROJECT_ID=<firebase-project-id>
     npx supabase functions deploy ask --use-api --no-verify-jwt
     ```
   Optional secret `LLM_MODEL` picks any OpenRouter model (default `google/gemini-3.6-flash`).
   If the function isn't deployed, Ask still works using the on‑device parser.

---

## What I built, and why

### The interface

- **Bubbles that are also clocks.** Each bubble shows today’s count, and its rim is a 24‑hour dial (midnight at the top) with a dot for every time you logged it today plus a faint “now” hand. The home screen answers *how many* **and** *when* without opening anything.
- **Frequent things are bigger and central.** Bubbles are circle‑packed; size comes from the last 14 days of use. That weight deliberately **excludes today**, so bubbles never grow or move under your finger while you tap. The layout settles once a day.
- **Tap = add one, hold = details.** A tap gives a haptic, a squish, a ripple and a floating “+1”, and shows a big **Undo** bar for 8 seconds.
- **Mistakes are one gesture away.** Every bubble with a count today has a **−** button on its rim, and a swipe down on the bubble also takes one away (“−1”, with Undo). The detail screen has a *Take one away* button too.
- **Two home styles.** Bubbles (default) or a plain **List** with big − / + buttons per row, switchable in Settings — for people who prefer buttons over gestures.
- **Nothing hidden.** Header buttons carry text labels (Insights, Settings), every screen has a labelled *Back* / *Close* / *Cancel*, pushed screens swipe back from anywhere, and a short tips card explains tap / − / hold until you’ve logged a few dozen entries.
- **Ideas never disappear.** First run shows a still grid of starter ideas (one tap each) plus *Make my own*. Afterwards the **+** opens the same grid (tap several, tap again to take one off), and while you have fewer than four bubbles a *More ideas* strip stays on the home screen.
- **A goal per bubble: just count / do more / do less.** More coffee isn’t “good” and more reading isn’t “bad”, so comparisons are coloured by the goal. “Do less” bubbles show a live *time since the last one* and the longest break instead of a streak.
- **Fair comparisons.** “This week vs last week” on a Monday morning compares against *last Monday morning*, not a whole week, everywhere in the app.
- **Back‑dating and fixing.** *Earlier…* logs something that already happened (with presets like “1 hour ago”). Tapping any time in the history lets you move or delete that entry.
- **Look and feel:** warm paper, black ink pills, soft 3D gradient bubbles, one rounded, highly legible family (Nunito) with large default text sizes. Light / Dark / Automatic chosen in Settings, Liquid Glass on iOS 26 for the + button, and Reduce Motion is respected.

### Screens

| Screen | What’s on it |
|---|---|
| Sign in | Google (native Google Sign-In → Firebase Auth), or try it without an account (local demo with sample data) |
| Home | Bubble field (or list), today’s total, tips, − buttons, Ask bar, + button, undo bar, sync indicator |
| Add | Grid of one-tap ideas, *Make my own*, Done |
| Bubble detail | Live time since last, today/week/month with fair deltas, all‑time, per‑day, streak or best break, 24h radial “when” chart, weekday bars, 15‑week calendar heatmap, full history grouped by day |
| New / edit bubble | Live preview, name, suggestions, emoji grid (or any emoji), colour, goal, “remember where” |
| Log earlier | Quick presets + date/time picker; also used to move an existing entry |
| Ask | Chat‑style questions with answer cards: headline number, sentence, mini chart, and chips showing how the question was understood |
| Insights | Week at a glance: today as a timeline, a category × weekday table, comparisons with last week, daily rhythm |
| Settings | Account, appearance (Automatic / Light / Dark), home style (Bubbles / List), sync status, CSV export, delete all data, sign out / leave demo |

---

## Architecture

```mermaid
flowchart LR
  subgraph iPhone["iPhone (Expo / React Native)"]
    UI["Screens<br/>expo-router"] --> Store["Local-first store<br/>zustand"]
    Store <--> Cache[("SQLite-backed<br/>localStorage cache")]
    Store --> Queue["Mutation queue<br/>(ordered, batched, retried)"]
    UI --> Engine["Query engine<br/>parse → spec → execute"]
    Engine --> Store
  end
  Queue -- "batched writes (security rules)" --> FS[("Cloud Firestore<br/>users/{uid}/categories · events")]
  FS -- "changes since last pull,<br/>on launch / foreground" --> Store
  Engine -- "question + category names only<br/>(Firebase ID token)" --> Fn["Supabase Edge function 'ask'<br/>OpenRouter (any model)"]
  Fn -- "QuerySpec JSON" --> Engine
  Auth["Firebase Auth<br/>Google"] --- FS
```

### Stack

- **App:** Expo SDK 58, React Native 0.88, TypeScript (strict), expo‑router, React Compiler, Reanimated 4, react‑native‑svg (all bubbles and charts are hand‑drawn SVG, no chart library).
- **Backend:** Firebase (JS SDK): Auth (Google) and Cloud Firestore with security rules. The AI `ask` function is a Deno edge function hosted on Supabase, because Cloud Functions aren’t available on Firebase’s free Spark plan.

### Data model

```
users/{uid}/categories/{id}  { id, name, emoji, color, goal 'track'|'more'|'less', track_location, created_at, updated_at }
users/{uid}/events/{id}      { id, category_id, occurred_at (ISO), tz, latitude, longitude, place, note,
                               source 'tap'|'manual'|'import', updated_at }
deleted docs become          { deleted: true, updated_at }   (tombstones, so other devices see deletes)
```

- Everything lives under the user’s own `uid`; the rules (`firebase/firestore.rules`) only let that signed‑in user read or write it, and validate every field (lengths, enums, coordinate ranges, `id` matching the doc id).
- `updated_at` is always the server time (`serverTimestamp()`, enforced by the rules). It drives incremental sync.
- `tz` stores the IANA zone the phone was in, so “what hour do I usually…” stays right after travel.
- Firestore has no cascades: deleting a category tombstones its events in batches first, then the category.

### Local‑first logging (the “Click. Click. Done.” part)

Tapping must never wait for the network:

1. The app creates the event with a **client‑generated UUID** and puts it in the in‑memory store immediately.
2. It appends a mutation to a **persistent queue** (stored with the cache in SQLite‑backed `localStorage`).
3. A sync loop replays the queue **in order**, batching runs of event writes (up to 200 per batched write). Because IDs come from the client, every write is an idempotent `set`, so retries can’t create duplicates.
4. Errors are sorted: network failures, timeouts and quota errors back off exponentially (2s → 60s) and retry; rule or validation errors drop just that item so one bad write can’t block the queue.
5. Edits to a row that hasn’t been sent yet are merged, and deleting something that was never sent cancels it locally.
6. On launch and on returning to the foreground: flush, then pull **only what changed** since the last pull (`updated_at >` a stored server‑time cursor), merge it into the cache, and re‑apply any still‑pending local changes on top. A quiet foreground costs zero document reads, which matters on the free tier’s 50k reads/day.

Location capture works the same way: the tap is saved first, then a recent cached GPS fix (or a balanced‑accuracy one) and a reverse‑geocoded place name are added in the background. Coordinates are rounded to about 11 m.

### Natural‑language questions (how AI is used)

The model **translates the question; it never answers it.**

```
"When did I smoke the most?"
   │
   ├─▶ edge function → LLM (temperature 0, JSON mode)
   │     input:  the question + category ids/names + today's date + time zone
   │     output: QuerySpec  { intent: "peak", categoryIds: ["…smoking"], range: { preset: "all_time" } }
   │
   ├─▶ sanitizeSpec(): validate the shape, drop unknown category ids, reject anything unusable
   │     (falls back to the on-device rule parser on timeout/error/invalid output)
   │
   └─▶ executeQuery(): deterministic TypeScript over the local event log
         → "~9 PM — Smoking usually happens around 9 PM, and Sundays are the busiest day…"
```

- **Exact numbers.** Every count, average and date comes from code, so the model can’t hallucinate statistics.
- **Privacy.** The model only sees the question and the names of your bubbles, never your history, times or locations.
- **Transparent.** Each answer shows chips for what it understood (category, range, intent) and whether the AI or the on‑device parser read the question.
- **Resilient.** A rule‑based parser (synonyms like *cigarettes → Smoking* and *latte → Coffee*, ranges like “last 30 days”, “in March”, “on weekends”, “after 10pm”) answers instantly offline and covers the common questions without any API key.
- **Safe with untrusted input.** Category names go into the prompt as quoted data with an instruction to treat them as labels, the request is size‑capped, and the output is validated.
- **The query language** (`src/lib/query/types.ts`) has ten intents: count, peak (by hour, weekday, day, week, month, or all of them), last, first, average (per day, week, month), compare, streak, gap, list and ranking. Each takes a time range and optional weekday or hour filters. Comparisons for the current period are clipped to the same elapsed point.

### Project layout

```
src/
  app/                    expo-router screens
    _layout.tsx           fonts, auth guard (Stack.Protected), data wiring
    index.tsx             home: bubble field or list, ask bar, undo
    add.tsx               one-tap ideas grid
    category/[id].tsx     detail, charts, history
    edit-category.tsx     create / edit / delete
    log-time.tsx          back-date or move an entry (form sheet)
    ask.tsx               natural-language questions
    insights.tsx          week overview
    settings.tsx          account, appearance, home style, sync, export, delete
    sign-in.tsx
  components/             Bubble (SVG clock bubble), TapBubble (gestures + animation), charts, buttons, icons
  lib/
    store.ts              local-first store + sync engine
    prefs.ts              device preferences (theme, home style)
    firebase.ts           lazy Firebase app / Auth / Firestore (+ firebase-auth.ts session persistence)
    auth.ts               Firebase Auth session and the local demo mode
    google-sign-in.ts     native Google Sign-In → Firebase credential (.web.ts: popup)
    stats.ts / time.ts    pure date & statistics helpers
    packing.ts            circle packing for the home screen
    query/                types · parse-local · sanitize · resolve · execute · ask
    demo.ts               deterministic sample data
  theme/                  colour tokens, typography, bubble palette
firebase/
  firestore.rules         per-user access + field validation
supabase/
  functions/ask/          edge function (single file): Firebase token check, prompt, validation, OpenRouter call
tests/query.test.ts       parser, executor, sanitizer and stats tests
```

### Testing

`npm test` runs 15 tests on the parts that must be exactly right: the two example questions from the brief, synonyms, ranges and filters, exact counts against a generated log, peak hour and weekday, “last time”, fair week‑vs‑week comparison, ranking, rejecting invented category ids from a model, period stats, streaks and gaps. Typecheck and lint pass.

---

## Trade‑offs and what I’d do next

- **Full history on the device.** The app keeps the whole event log locally so stats and queries are instant and work offline. That’s fine for years of personal logging (tens of thousands of docs); the first sign‑in on a new device reads them all once, later pulls read only changes.
- **Sync conflicts** are last‑write‑wins per doc, which is right for a single person on one or two devices. Deletes from another device arrive on the next pull as tombstones. Firestore `onSnapshot` listeners would make it live, at the cost of more reads.
- **Free tier.** Firestore’s Spark plan allows 50k reads / 20k writes per day for the whole project. Incremental pulls keep reads low; when a quota runs out the app keeps working locally and syncs once it resets.
- **Native Google Sign‑In** needs a development build; the demo still runs in Expo Go.
- **Next:** Home Screen widget and Lock Screen / Control Center buttons (logging without opening the app), Siri/App Intents (“log a coffee”), reminders for “do more” goals, Apple Health import for things like workouts, a map of where things happen, and an AI weekly summary built on the same spec engine.

## Notes

- The edge function verifies the caller’s Firebase ID token (signature, issuer, audience, expiry), so only signed‑in users can call it. The demo never calls it and answers questions on‑device.
- `src/app/explore.tsx` only redirects. It’s left over from the Expo template and can be deleted.
