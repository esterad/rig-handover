import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';

export type NightCounts = { ok: number; retry: number; fail: number };

/** Counts parsed lines per status in `<runsDir>/<night>.jsonl`. Bad lines are skipped. */
export function countNight(runsDir: string, night: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return counts;
  }
  for (const t of text.split(/\r?\n/)) {
    if (t.trim() === '') continue;
    const line = parseLine(t);
    if (line) counts[line.status] += 1;
  }
  return counts;
}
