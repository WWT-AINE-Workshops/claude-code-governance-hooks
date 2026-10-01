// Audit log for PostToolUse and PostToolUseFailure. Appends one JSON line per tool call to .audit/audit.jsonl.
// Secrets are redacted before anything is written, and each record is chained to the one before it.
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';

const GENESIS = '0'.repeat(64);

// Patterns for secrets inside any text: start-of-line and CSV positions included, so no \b before them.
const SECRETS = [
  /(?<![A-Za-z0-9])(AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9])/g,
  /((?:aws_)?secret_?access_?key["'\s:=]+)[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/gi,
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36,}/g,
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

// A field whose name says it holds a secret is redacted whole, whatever its value looks like.
const SECRET_FIELD = /(secret|token|password|passwd|api[_-]?key|private[_-]?key)/i;

// A bare 40-character token in AWS secret key shape: mixed case, and a / or a +. A hex git SHA never matches.
const BARE_SECRET = /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g;
const looksLikeSecret = (t) => /[a-z]/.test(t) && /[A-Z]/.test(t) && /[/+]/.test(t);

const redactText = (text) =>
  SECRETS.reduce(
    (out, pattern) =>
      out.replace(pattern, (match, prefix) =>
        typeof prefix === 'string' && /key/i.test(prefix) ? `${prefix}[REDACTED]` : '[REDACTED]',
      ),
    text,
  ).replace(BARE_SECRET, (t) => (looksLikeSecret(t) ? '[REDACTED]' : t));

// Walks the value and redacts every string in it, so the patterns see real text, not JSON escapes.
function redact(value, key = '') {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return SECRET_FIELD.test(key) ? '[REDACTED]' : redactText(value);
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

const hashOf = (record) => createHash('sha256').update(JSON.stringify(record)).digest('hex');

// The hash of the last record, or GENESIS for an empty log. A last line that is not a chained record (an old
// line, or one broken by hand) also gives GENESIS: auditing goes on, and audit:verify shows the break there.
function lastHash(file) {
  if (!existsSync(file)) return GENESIS;
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  try {
    const hash = JSON.parse(lines.at(-1) ?? '{}').hash;
    return typeof hash === 'string' ? hash : GENESIS;
  } catch {
    return GENESIS;
  }
}

// Two tool calls can finish at once, so take a lock while reading the last hash and appending.
function withLock(dir, fn) {
  const lock = join(dir, '.lock');
  const until = Date.now() + 2000;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx'));
      break;
    } catch {
      if (Date.now() > until) rmSync(lock, { force: true });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    fn();
  } finally {
    rmSync(lock, { force: true });
  }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const dir =
    process.env.AUDIT_DIR ?? join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), '.audit');
  const file = join(dir, 'audit.jsonl');
  mkdirSync(dir, { recursive: true });
  withLock(dir, () => {
    const record = {
      at: new Date().toISOString(),
      event: input.hook_event_name,
      session_id: input.session_id,
      prompt_id: input.prompt_id ?? null,
      tool_use_id: input.tool_use_id ?? null,
      tool: input.tool_name,
      input: redact(input.tool_input),
      response: redact(input.tool_response),
      error: redact(input.error),
      prev: lastHash(file),
    };
    appendFileSync(file, `${JSON.stringify({ ...record, hash: hashOf(record) })}\n`);
  });
} catch (err) {
  console.error(`audit hook: ${err.message}`);
}
