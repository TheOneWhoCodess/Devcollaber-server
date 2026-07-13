// This file MUST be required as the very first line of server.js,
// before any other require (including app.js) — Sentry needs to
// initialize before other modules load to auto-instrument them
// correctly (Express, Mongoose, etc.).

const Sentry = require('@sentry/node');

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Only send events in production — avoids noisy local dev errors
    // (and Sentry's free tier event quota) piling up while testing.
    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0.2, // sample 20% of requests for performance tracing, not 100% — keeps quota usage reasonable
    environment: process.env.NODE_ENV || 'development',
});

module.exports = Sentry;