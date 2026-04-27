// Kill switch. Asks the control plane whether agents may run, before every prompt and tool call.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const url = process.env.KILLSWITCH_URL ?? 'http://127.0.0.1:3002';

try {
  const res = await fetch(`${url}/v1/status`);
  const status = await res.json();
  if (status.mode === 'halt') {
    console.log(
      JSON.stringify({ continue: false, stopReason: `Halted by governance: ${status.reason}` }),
    );
  } else if (status.mode === 'suspend' && status.tools.includes(input.tool_name)) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `${input.tool_name} is suspended: ${status.reason}`,
        },
      }),
    );
  }
} catch {
  // No answer from the control plane.
}

process.exit(0);
