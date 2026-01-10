# Production Risk Audit (Post Decimal/Luxon Migration)

Scope: backend routes/controllers/middleware, webhook, auth, wallet/bets flows, CSRF/CORS.

## Critical

1) Manual deposit endpoint can credit balance without payment verification in production if left enabled.
   - File: src/controllers/walletController.js:90
   - Risk: any authenticated user could credit funds (fraud).
   - Status: PATCHED (guard added, require admin or ALLOW_MANUAL_DEPOSIT=true).

2) JWT secret fallback allows token forgery when env var is missing.
   - Files: src/middleware/auth.js:4, src/middlewares/authMiddleware.js:5, src/controllers/authController.js:7
   - Risk: anyone can mint valid tokens if default secret is used.
   - Status: PATCHED (fail fast when JWT_SECRET is missing).

## High

3) Bet creation is not idempotent (no Idempotency-Key / unique constraint), enabling double-debit on retries.
   - File: src/controllers/betController.js:205-304
   - File: src/services/betService.js:70-155
   - Risk: duplicate charge on network retries or client double-submit.
   - Recommendation: add Idempotency-Key header support + unique DB constraint, or request hash on bet table.

4) Recheck flow can double-adjust balances if two rechecks run concurrently.
   - File: src/controllers/adminController.js:975-989
   - Risk: duplicate decrement/increment if concurrent rechecks are executed.
   - Recommendation: updateMany with optimistic guard (status/prize) or use a recheck lock.

## Medium

5) Webhook replay protection relies on credited flag only; no eventId storage.
   - File: src/controllers/webhookController.js:120-210
   - Risk: replays are mostly stopped, but no audit trail or event de-dup key.
   - Recommendation: persist eventId/signature hash and reject duplicates.

6) CSRF allows requests with missing Origin/Referer.
   - File: src/middleware/csrf.js:12-25
   - Risk: low on modern browsers, but weakens CSRF posture.
   - Recommendation: allow empty origin only for explicit allowlist (e.g., mobile client token).

7) Logs may expose sensitive data in production (bet/user IDs, correlation IDs, amounts).
   - Files: src/controllers/betController.js:214, src/controllers/adminController.js:543, src/controllers/webhookController.js:192, src/controllers/pixController.js:75
   - Risk: privacy/compliance and operational leakage.
   - Recommendation: route all logs through a structured logger with redaction.

## Low

8) Duplicate webhook route registration (/api/webhook/openpix and /api/pix/webhook/openpix).
   - Files: index.js:48, src/routes/pixRoutes.js:23
   - Risk: confusion, inconsistent middleware (CSRF), and attack surface.
   - Recommendation: keep only one endpoint.

9) Profile update lacks strict validation on email/birthDate formats.
   - File: src/controllers/profileController.js:3-42
   - Risk: data quality (not security-critical).

## Patches Applied (Top 5)

1) JWT secret enforcement
   - Files: src/middleware/auth.js, src/middlewares/authMiddleware.js, src/controllers/authController.js

2) Manual deposit guard
   - File: src/controllers/walletController.js:90-94

3) Withdrawal request now debits balance inside a transaction
   - File: src/controllers/walletController.js:178-225

4) Input size limits for bets
   - Files: src/controllers/betController.js:18-31, src/services/betService.js:26-52

5) Sensitive debug logs gated by env flags
   - Files: src/controllers/authController.js:176-178, src/routes/adminRoutes.js:11-16

## Missing Integration Tests (Supertest)

- POST /api/bets (idempotency key; retry same payload should not double-debit).
- POST /api/wallet/withdraw (concurrent requests should debit once).
- POST /api/admin/bets/:id/recheck (concurrent rechecks should not double-adjust).
- POST /api/webhook/openpix (replay same event should be idempotent).
- POST /api/auth/reset (rate limit and no code leakage in production).
- POST /api/pix/charge (reject invalid amount formats; ensure Decimal parsing).

