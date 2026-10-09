# Derby Bus Dismissal

A quiet, live bus-dismissal board for Derby Middle School. A dispatcher calls buses from a phone controller while classroom displays update within roughly one polling interval.

- Display: https://derby-dismissal.jjason123.chatgpt.site
- Controller: https://derby-dismissal.jjason123.chatgpt.site/controller

The hosted pilot is private and requires the owner's ChatGPT sign-in.

## Dismissal workflow

The controller contains the nine school buses: **51, 52, 53, 54, 55, 56, 57, 59, and 60**.

1. Tap a bus once when it arrives.
2. Its controller button turns red and locks.
3. The classroom display moves that bus into the current-call panel, keeps earlier calls visible, and removes called buses from the waiting strip.
4. Use **Clear board** whenever the run is finished—or anytime you need to restart a demo.
5. Clearing immediately resets every connected display and unlocks every controller button.

There is intentionally no single-bus undo operation. The server rejects duplicate bus calls; the explicit full-board reset is the only way to unlock called buses.

## Design

The responsive UI uses a purpose-made Character Counts background asset for the display. Live bus numbers are overlaid as text so they remain sharp and update immediately. The phone controller reuses crops from the same artwork for consistent Derby branding.

- Artwork: `public/art/dismissal-board.jpg`
- Display font: `public/fonts/derby-numbers.ttf`
- Font license: `public/fonts/LICENSE.txt`

## Technology

- React 19 / Vinext
- Cloudflare Worker runtime
- Cloudflare D1 for shared dismissal state
- ChatGPT Sites hosting and access control

State updates use revision checks and request IDs to prevent lost updates and duplicate submissions. Classroom displays poll every 750 ms, report their received revision, and show a connection warning if updates stop.

## Local development

```bash
npm install
npm run db:generate
npm run build
npm start
```

For a local D1 preview, apply the generated migration in `drizzle/` using the command documented in the Sites Vinext starter. The deployment manifest is in `.openai/hosting.json`.

## Verification

```bash
node tests/state.mjs
npx tsc --noEmit
npm run build
```
