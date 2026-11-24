import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

/** Parses one log line at the edge. Anything off-shape is `null`, never thrown. */
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  const line: RunLine = { at: o.at, job: o.job, status: o.status as RunStatus, owner: o.owner };
  if (o.error !== undefined) line.error = o.error as string;
  return line;
}

/** Folds parsed lines into one row per job, sorted by job. Lines stay in file order. */
export function foldRows(lines: RunLine[]): DigestRow[] {
  const byJob = new Map<string, DigestRow>();
  for (const l of lines) {
    const row = byJob.get(l.job);
    if (!row) {
      byJob.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error ?? null,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    row.runs += 1;
    if (l.status === 'retry') row.retries += 1;
    row.lastStatus = l.status;
    if (l.error !== undefined) row.lastError = l.error;
    if (l.owner !== null) row.owner = l.owner;
    row.lastAt = l.at;
  }
  return [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;
  const lines: RunLine[] = [];
  let badLines = 0;
  for (const text of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (line) lines.push(line);
    else badLines += 1;
  }
  const result: DigestNight = { night, rows: foldRows(lines), badLines };
  return result;
};
