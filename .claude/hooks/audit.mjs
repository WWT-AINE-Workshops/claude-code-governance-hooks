// PostToolUse audit log. Appends one JSON line per tool call to .audit/audit.jsonl.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const dir =
  process.env.AUDIT_DIR ?? join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), '.audit');

const record = {
  at: new Date().toISOString(),
  session: input.session_id,
  tool: input.tool_name,
  input: input.tool_input,
  response: input.tool_response,
};

mkdirSync(dir, { recursive: true });
appendFileSync(join(dir, 'audit.jsonl'), `${JSON.stringify(record)}\n`);
