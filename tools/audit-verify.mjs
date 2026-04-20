// Checks the audit log's hash chain: npm run audit:verify [-- path/to/audit.jsonl]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyChain } from './audit-chain.mjs';

const file = process.argv[2] ?? join(process.cwd(), '.audit', 'audit.jsonl');
if (!existsSync(file)) {
  console.error(
    `No audit log at ${file}. Use Claude Code in this folder first, so the audit hook writes one.`,
  );
  process.exit(1);
}

const result = verifyChain(readFileSync(file, 'utf8'));
if (result.ok) {
  console.log(`Chain intact: ${result.count} records.`);
} else {
  console.error(`Chain broken at line ${result.line}: ${result.why}.`);
  process.exit(1);
}
