# Independent deployment checklist (work in progress)

The existing production version is still hosted through ChatGPT Sites. This branch introduces a controller-only, four-digit PIN with a 30-day signed, HttpOnly cookie; display remains open.

**Do not deploy publicly until the following steps are done:**

1. Create a Cloudflare D1 database named `derby-bus-dismissal`.
2. Provision its tables using the existing Drizzle migration(s) for `dismissal` and `screens`, then `drizzle/0001_controller_pin.sql` for `login_attempts`.
3. Bind that D1 database to the Worker using binding name **DB** (the exact name is required).
4. Configure two **Cloudflare encrypted secrets**, *never in GitHub or committed code*:
   - `CONTROLLER_PIN`: a four-digit code selected privately by the school coordinator.
   - `SESSION_SECRET`: randomly generated secret of at least 32 characters.
5. Replace the ChatGPT Sites-specific Vite hosting integration with an ordinary Vinext/Cloudflare Worker build. The present `vite.config.ts` imports a Sites-specific plugin, so selecting the repository's default build settings is **not sufficient**. The Worker must support Next.js routes and D1; GitHub Pages alone cannot do this.
6. Only then configure automatic deployment from GitHub `main` and test from *another browser without a ChatGPT login*.

The independent public service should serve **/** (teacher display; no PIN) and **/controller** (coordinator; PIN required first time and again after 30 days or sign-out).

**Security note:** A four-digit shared PIN offers limited protection. Five attempts are allowed per IP per rolling 15-minute period; a distributed attacker can still probe from multiple IPs. Use only if this security trade-off is acceptable for the school's operational process. Real bus dismissal should always have a manual fallback. Do not publish a working controller before verifying access controls.

No Cloudflare account, database, or production deployment was created or changed from this branch.
