# Derby Bus Dismissal

A quiet, live bus-dismissal board for Derby Middle School. A dispatcher calls buses from a phone controller while classroom displays update within roughly one polling interval.

- Display: https://derby-dismissal.jjason123.chatgpt.site
- Controller: https://derby-dismissal.jjason123.chatgpt.site/controller

The hosted pilot is private and requires the owner's ChatGPT sign-in.

## Dismissal workflow

The controller contains the ten school buses: **51, 52, 53, 54, 55, 56, 57, 58, 59, and 60**.

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

To demo outside dismissal hours, open `/controller?demo=1` and `/?demo=1`. Demo calls use a separate daily D1 state, so they cannot affect the real classroom board. Demo pages poll live for 20 minutes, then pause until reloaded. At 2:45 p.m. on a weekday, any open demo page automatically navigates to its real display or controller URL; the real controller asks for the PIN again. The demo controller still requires the PIN; clear its calls to begin another run.

State updates use revision checks and request IDs to prevent lost updates and duplicate submissions. Classroom displays run on a weekday schedule in America/New_York: live from 2:45 to 3:20 p.m. (checks every 3 seconds), idle outside that window (checks every 5 minutes). Displays report their received revision during dismissal, hide bus calls outside the window, and show a connection warning if live updates stop. Keep devices' clocks accurate; the schedule uses the browser's clock. The controller follows the same polling schedule and still refreshes immediately after a call or reset.

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
