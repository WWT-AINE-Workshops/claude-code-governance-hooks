// Runs a hook against saved inputs, without starting Claude Code: npm run hooks:try -- guard|audit|killswitch|managed
// A fixture in tools/fixtures/<hook>/ holds the hook's stdin ("input", or "raw" text) and the verdict it should get.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyChain } from './audit-chain.mjs';

const ROOT = join(import.meta.dirname, '..');
const HOOK_TIMEOUT_MS = 6000;

// Runs node on a hook file with `stdin`, and resolves { code, stdout, stderr, ms, timedOut }.
function runHook(file, stdin, env = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [file], {
      cwd: ROOT,
      // A fixture sets the fail mode it tests; your terminal's own setting never leaks in.
      env: { ...process.env, KILLSWITCH_FAIL_MODE: '', CLAUDE_PROJECT_DIR: ROOT, ...env },
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, HOOK_TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, ms: Date.now() - started, timedOut });
    });
    child.stdin.end(stdin);
  });
}

// How Claude Code reads a hook's answer. Valid JSON on stdout counts whatever the exit code; exit 2 blocks on its
// own; any other exit code, a crash or a timeout is a non-blocking error, so the action goes ahead.
function verdictOf(run) {
  if (run.timedOut) {
    return {
      verdict: 'allow',
      how: 'timed out: the call goes ahead, unless the handler sets onFailure block',
    };
  }
  let json;
  const text = run.stdout.trim();
  if (text.startsWith('{')) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  if (json?.continue === false)
    return { verdict: 'halt', how: `continue: false (exit ${run.code})` };
  if (run.code === 2) return { verdict: 'block', how: 'exit 2' };
  const decision = json?.hookSpecificOutput?.permissionDecision;
  if (decision === 'deny') return { verdict: 'block', how: `decision deny (exit ${run.code})` };
  if (decision) return { verdict: decision, how: `decision ${decision} (exit ${run.code})` };
  if (run.code === 0) return { verdict: 'allow', how: 'exit 0, no decision' };
  return {
    verdict: 'allow',
    how: `exit ${run.code}: a non-blocking error, so the call goes ahead unless the handler sets onFailure block`,
  };
}

const fixtures = (hook) => {
  const dir = join(ROOT, 'tools', 'fixtures', hook);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      id: f.replace(/\.json$/, ''),
      ...JSON.parse(readFileSync(join(dir, f), 'utf8')),
    }));
};

const stdinOf = (fx) => fx.raw ?? JSON.stringify(fx.input);
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

// The handlers registered for `event` in a settings object, as an array.
const handlers = (settings, event) =>
  (settings.hooks?.[event] ?? []).flatMap((group) => group.hooks ?? []);
const runsScript = (h, name) =>
  [h.command, ...(h.args ?? [])].some((p) => String(p).includes(name));
const registered = (settings, event, name) =>
  handlers(settings, event).some((h) => runsScript(h, name));

const results = [];
const record = (pass, id, detail) => results.push({ pass, id, detail });

async function tryGuard() {
  const file = join(ROOT, '.claude/hooks/guard.mjs');
  for (const fx of fixtures('guard')) {
    const run = await runHook(file, stdinOf(fx));
    const got = verdictOf(run);
    // An allow only counts when the guard ran cleanly: a crash that lets a call through is not a decision.
    const pass =
      fx.expect === 'allow' ? got.verdict === 'allow' && run.code === 0 : got.verdict === 'block';
    record(pass, fx.id, `expected ${fx.expect}, got ${got.verdict} (${got.how})`);
  }
}

async function tryAudit() {
  const file = join(ROOT, '.claude/hooks/audit.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'audit-try-'));
  const log = join(dir, 'audit.jsonl');
  try {
    for (const fx of fixtures('audit')) {
      const run = await runHook(file, stdinOf(fx), { AUDIT_DIR: dir });
      let lines = [];
      try {
        lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
      } catch {
        lines = [];
      }
      const last = lines.at(-1) ?? '';
      let rec = {};
      try {
        rec = JSON.parse(last);
      } catch {
        rec = {};
      }
      const wrote = lines.length > 0 && rec.tool === fx.input.tool_name;
      const leaked = (fx.mustNotContain ?? []).filter((s) => last.includes(s));
      const missing = ['prompt_id', 'event', 'tool'].filter((k) => rec[k] === undefined);
      const wrong = [];
      if (rec.prompt_id !== undefined && rec.prompt_id !== fx.input.prompt_id)
        wrong.push('prompt_id');
      if (rec.event !== undefined && rec.event !== fx.input.hook_event_name) wrong.push('event');
      const problems = [
        !wrote && `no record written (exit ${run.code})`,
        leaked.length && `secret in the log: ${leaked.join(', ')}`,
        missing.length && `missing ${missing.join(', ')}`,
        wrong.length && `wrong ${wrong.join(', ')}`,
      ].filter(Boolean);
      record(
        problems.length === 0,
        fx.id,
        problems.length ? problems.join('; ') : 'record written, redacted, with prompt_id',
      );
    }
    let text = '';
    try {
      text = readFileSync(log, 'utf8');
    } catch {
      text = '';
    }
    const chain = verifyChain(text);
    record(
      chain.ok,
      'chain',
      chain.ok
        ? `intact across ${chain.count} records`
        : `broken at line ${chain.line}: ${chain.why}`,
    );
    if (chain.ok) {
      const lines = text.split('\n').filter(Boolean);
      const edited = JSON.parse(lines[0]);
      edited.tool = 'Edited';
      lines[0] = JSON.stringify(edited);
      writeFileSync(log, `${lines.join('\n')}\n`);
      const after = verifyChain(readFileSync(log, 'utf8'));
      record(
        !after.ok,
        'tamper',
        after.ok
          ? 'an edited line went unnoticed'
          : `an edited line is caught at line ${after.line}`,
      );
    } else {
      record(false, 'tamper', 'needs an intact chain first');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const settings = readJson('.claude/settings.json');
  for (const event of ['PostToolUse', 'PostToolUseFailure']) {
    const ok = registered(settings, event, 'audit.mjs');
    record(
      ok,
      `settings-${event}`,
      ok ? `audit.mjs runs on ${event}` : `audit.mjs is not registered on ${event}`,
    );
  }
}

// A stand-in control plane for one fixture: run, halt, suspend:<Tool>, error500 or slow.
function stubControlPlane(state) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const send = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const status = (mode, tools = [], reason = '') => ({
        mode,
        tools,
        reason,
        changedAt: '2026-04-27T09:00:00.000Z',
      });
      if (state === 'error500') return send(500, { error: 'internal error' });
      if (state === 'slow') return setTimeout(() => send(200, status('run')), 10_000);
      if (state === 'halt') return send(200, status('halt', [], 'drill'));
      if (state.startsWith('suspend:'))
        return send(200, status('suspend', [state.slice(8)], 'vendor incident'));
      return send(200, status('run'));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// A port nothing listens on: open one, note it, close it.
const closedPort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function tryKillswitch() {
  const file = join(ROOT, '.claude/hooks/killswitch.mjs');
  for (const fx of fixtures('killswitch')) {
    let server;
    let url;
    if (fx.controlPlane === 'down') {
      url = `http://127.0.0.1:${await closedPort()}`;
    } else {
      server = await stubControlPlane(fx.controlPlane);
      url = `http://127.0.0.1:${server.address().port}`;
    }
    const run = await runHook(file, stdinOf(fx), { KILLSWITCH_URL: url, ...fx.env });
    server?.closeAllConnections();
    server?.close();
    const got = verdictOf(run);
    const map = { allow: 'continue', block: 'deny', halt: 'halt' };
    const verdict = map[got.verdict] ?? got.verdict;
    const slow = fx.withinMs && run.ms > fx.withinMs;
    const pass = verdict === fx.expect && !slow;
    const time = fx.withinMs
      ? `, in ${(run.ms / 1000).toFixed(1)} s (limit ${fx.withinMs / 1000} s)`
      : '';
    record(
      pass,
      fx.id,
      `control plane ${fx.controlPlane}: expected ${fx.expect}, got ${verdict} (${got.how})${time}`,
    );
  }
  const settings = readJson('.claude/settings.json');
  for (const event of ['UserPromptSubmit', 'PreToolUse']) {
    const ok = registered(settings, event, 'killswitch.mjs');
    record(
      ok,
      `settings-${event}`,
      ok ? `killswitch.mjs runs on ${event}` : `killswitch.mjs is not registered on ${event}`,
    );
  }
}

async function tryManaged() {
  const m = readJson('managed/managed-settings.json');
  const has = (list, rule) => (m.permissions?.[list] ?? []).includes(rule);
  const checks = [
    ['allowManagedHooksOnly', m.allowManagedHooksOnly === true, 'only managed hooks run'],
    [
      'allowManagedPermissionRulesOnly',
      m.allowManagedPermissionRulesOnly === true,
      'only managed permission rules apply',
    ],
    [
      'disableBypassPermissionsMode',
      m.permissions?.disableBypassPermissionsMode === 'disable',
      'nobody can switch on bypass mode',
    ],
    ['deny-env', has('deny', 'Read(**/.env)'), 'Read(**/.env) is denied'],
    ['deny-secrets', has('deny', 'Read(**/secrets/**)'), 'Read(**/secrets/**) is denied'],
    ['ask-push', has('ask', 'Bash(git push *)'), 'a human confirms every git push'],
  ];
  for (const event of ['UserPromptSubmit', 'PreToolUse']) {
    const ks = handlers(m, event).filter((h) => runsScript(h, 'killswitch.mjs'));
    checks.push([
      `killswitch-${event}`,
      ks.length > 0 && ks.every((h) => h.onFailure === 'block'),
      `the kill switch runs on ${event} and blocks if it fails`,
    ]);
  }
  for (const event of ['PostToolUse', 'PostToolUseFailure']) {
    checks.push([
      `audit-${event}`,
      registered(m, event, 'audit.mjs'),
      `the audit hook runs on ${event}`,
    ]);
  }
  for (const [id, pass, what] of checks) record(pass, id, pass ? what : `not yet: ${what}`);
}

const HOOKS = { guard: tryGuard, audit: tryAudit, killswitch: tryKillswitch, managed: tryManaged };
const name = process.argv[2];
if (!HOOKS[name]) {
  console.error(`Usage: npm run hooks:try -- <${Object.keys(HOOKS).join('|')}>`);
  process.exit(2);
}

await HOOKS[name]();
const width = Math.max(...results.map((r) => r.id.length));
console.log(`${name}: ${results.length} checks`);
for (const r of results)
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(width)}  ${r.detail}`);
const passed = results.filter((r) => r.pass).length;
console.log(`${passed} of ${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
