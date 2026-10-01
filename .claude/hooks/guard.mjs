// PreToolUse guard for Bash and Read. Blocks destructive commands and keeps secrets out of the session.
// Fails closed: anything unexpected, including input it cannot read, is denied.
import { readFileSync } from 'node:fs';

const SAFE_DELETE = /^rm\s+-rf\s+(\.\/)?node_modules\/\.cache\/?$/;

const SECRET_PATH = /(^|\/)(\.env(\.[\w.-]+)?|secrets\/.*)$/;

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

// Exit 2 is the only exit code that blocks on its own. Claude Code shows stderr to Claude as the reason.
function deny(reason) {
  console.error(`Blocked by policy: ${reason}`);
  process.exit(2);
}

function check(input) {
  const tool = input.tool_name;
  const args = input.tool_input;
  if (typeof args !== 'object' || args === null) deny(`no tool input for ${tool}`);
  if (tool === 'Bash') {
    if (typeof args.command !== 'string') deny('a Bash call with no command');
    for (const rule of BASH_RULES) {
      if (rule.test(args.command) && !rule.except?.(args.command)) deny(rule.reason);
    }
  }
  if (tool === 'Read' && SECRET_PATH.test(String(args.file_path))) {
    deny('Secrets stay out of the session');
  }
}

try {
  check(JSON.parse(readFileSync(0, 'utf8')));
} catch (err) {
  deny(`the guard could not check this call (${err.message})`);
}
process.exit(0);
