// Talks to the control plane: npm run halt -- --reason "drill", npm run resume, npm run suspend -- --tool WebFetch --reason "vendor incident".
import { parseArgs } from 'node:util';

const url = process.env.KILLSWITCH_URL ?? 'http://127.0.0.1:3002';
const [action = 'status', ...rest] = process.argv.slice(2);
let values;
try {
  ({ values } = parseArgs({
    args: rest,
    options: { reason: { type: 'string' }, tool: { type: 'string', multiple: true } },
  }));
} catch (err) {
  console.error(`${err.message}. Options: --reason "text", and --tool <name> for suspend.`);
  process.exit(2);
}

const requests = {
  status: () => ['GET', '/v1/status', undefined],
  halt: () => ['POST', '/v1/halt', { reason: values.reason ?? 'halted from the command line' }],
  resume: () => ['POST', '/v1/resume', undefined],
  suspend: () => [
    'POST',
    '/v1/suspend',
    { reason: values.reason ?? 'suspended from the command line', tools: values.tool ?? [] },
  ],
};

if (!requests[action]) {
  console.error(`Unknown action "${action}". Use status, halt, resume or suspend.`);
  process.exit(2);
}

const [method, path, body] = requests[action]();
let res;
try {
  res = await fetch(`${url}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3000),
  });
} catch {
  console.error(
    `The control plane is not answering at ${url}. Start it with: npm run control-plane`,
  );
  process.exit(1);
}

let status;
try {
  status = await res.json();
} catch {
  console.error(`Something else is answering at ${url}: its reply is not the control plane's.`);
  process.exit(1);
}
if (!res.ok) {
  console.error(`The control plane refused: ${status.error}`);
  process.exit(1);
}
const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
const tools = status.tools.length ? ` Tools: ${status.tools.join(', ')}.` : '';
const reason = status.reason ? ` Reason: ${status.reason}.` : '';
console.log(`${time} Mode: ${status.mode}.${tools}${reason}`);
