# Interval Timer

Interval timer for hangboard sessions. Build routines out of blocks, then run
them hands-free with the space-bar.

## Model

A **routine** is a list of **blocks**:

- **Set** — a name, a rep count, a duration, and the break between reps.
  Breaks are generated *between* reps only, so a block never ends on one.
  `3 reps × 30s / 20s break` = 130s.
- **Break** — a standalone named break, for the longer gap between sets.

At run time the routine is flattened into a timeline of countdowns
(`src/lib/types.ts` → `expandRoutine`). The sidebar still shows blocks, and each
one jumps to the first countdown inside it.

## Controls

The space-bar plays and pauses — it's the only key bound, so you can hit it blind
mid-hang. On screen: **Back** steps to the previous segment, or says **Reset**
and restarts the current one once it's a second in; **Skip** jumps forward.

Green means work, blue means break — there's no text label for the two, the
colour carries it. Transition beeps and the 3·2·1 countdown live in Settings
(gear, top of the sidebar) and are remembered across sessions; turn both off for
a silent run. The screen is kept awake while a routine is running, where the
browser supports it.

## Storage

Routines live in `localStorage` — no accounts, no server. Export and Import on
the home page move them between browsers as JSON; imported routines get fresh
ids, so importing never overwrites what's already there.

## Develop

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Deploy

Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new),
or:

```bash
npx vercel        # preview
npx vercel --prod # production
```

No environment variables or build configuration needed.
