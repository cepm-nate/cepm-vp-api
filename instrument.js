// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

// Read the version from package.json
const { version } = require('./package.json');

Sentry.init({
  dsn: "https://e61c339f05c76ad6c1d782b9acbacbf3@o4510524012167168.ingest.us.sentry.io/4510603128668160",
  integrations: [
    nodeProfilingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    Sentry.httpIntegration({ tracing: true }),
  ],
  release: `cepm-api@${version}`,
  // Send structured logs to Sentry
  enableLogs: true,
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: 'trace',
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  beforeSend: function(event) {
    if (event.request) {
      // Scrub password in URL params
      if (event.request.url) {
        event.request.url = event.request.url.replace(/([?&])password=[^&]*/gi, '$1password=[REDACTED]');
        event.request.url = event.request.url.replace(/([?&])token=[^&]*/gi, '$1token=[REDACTED]');
      }
      // Scrub password in headers
      if (event.request.headers) {
        for (const key in event.request.headers) {
          if (key.toLowerCase() === 'password' || key.toLowerCase() === 'token') {
            event.request.headers[key] = '[REDACTED]';
          }
        }
      }
      // Scrub password in query object if exists
      if (event.request.query && typeof event.request.query === 'object') {
        for (const key in event.request.query) {
          if (key.toLowerCase() === 'password' || key.toLowerCase() === 'token') {
            event.request.query[key] = '[REDACTED]';
          }
        }
      }
    }
    return event;
  },

  beforeSendTransaction: (transaction) => {
    transaction.spans = transaction.spans.filter((span) => {
      if (span.op === 'middleware.express') return false;
      if (span.op === 'db.statement' && span.description?.trim() === 'SELECT 1;') return false;
      return true;
    });
    return transaction;
  },
});
