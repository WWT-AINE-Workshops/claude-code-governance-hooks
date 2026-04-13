// PreToolUse guard for Bash and Read. Blocks destructive commands and keeps secrets out of the session.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const tool = input.tool_name;
const args = input.tool_input;

const SAFE_DELETE = /^rm\s+-rf\s+(\.\/)?node_modules\/\.cache\/?$/;

const SECRET_PATH = /(^|\/)(\.env(\.[\w-]+)?|secrets\/.*)$/;

const BASH_RULES = [
  {
    reason: 'Recursive force delete is not allowed',
    test: (cmd) =>
      /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|-r\s+-f|-f\s+-r|--recursive\s+--force|--force\s+--recursive)\b/i.test(
        cmd,
      ),
    except: (cmd) => SAFE_DELETE.test(cmd.trim()),
  },
  {
    reason: 'Force pushing is not allowed',
    test: (cmd) => /\bgit\s+push\b.*(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/.test(cmd),
  },
  {
    reason: 'Reading secrets from the shell is not allowed',
    test: (cmd) => /\b(cat|head|tail|less|more|grep|source)\b[^|;&]*(^|\s|\/)\.env\b/.test(cmd),
  },
];

function deny(reason) {
  console.error(`Blocked by policy: ${reason}`);
  process.exit(1);
}

if (tool === 'Bash') {
  const command = args.command;
  for (const rule of BASH_RULES) {
    if (rule.test(command) && !rule.except?.(command)) deny(rule.reason);
  }
}

if (tool === 'Read' && SECRET_PATH.test(args.file_path)) {
  deny('Secrets stay out of the session');
}

process.exit(0);
