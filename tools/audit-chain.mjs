// The audit log's hash chain. Each record carries prev (the hash of the record before it, or GENESIS for the first)
// and hash: the SHA-256 of the record's JSON without its hash field.
import { createHash } from 'node:crypto';

export const GENESIS = '0'.repeat(64);

export const hashOf = (record) => {
  const rest = { ...record };
  delete rest.hash;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex');
};

// Returns { ok: true, count } or { ok: false, line, why } for the text of an audit.jsonl file.
export function verifyChain(text) {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { ok: false, line: 0, why: 'the log is empty' };
  let prev = GENESIS;
  for (const [i, line] of lines.entries()) {
    const n = i + 1;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      return { ok: false, line: n, why: 'the line is not valid JSON' };
    }
    if (typeof record.hash !== 'string' || typeof record.prev !== 'string') {
      return {
        ok: false,
        line: n,
        why: 'the record has no prev and hash fields, so an edit cannot be detected',
      };
    }
    if (record.prev !== prev)
      return { ok: false, line: n, why: 'prev does not match the record before it' };
    if (hashOf(record) !== record.hash)
      return { ok: false, line: n, why: 'the hash does not match the record' };
    prev = record.hash;
  }
  return { ok: true, count: lines.length };
}
