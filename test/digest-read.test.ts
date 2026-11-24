import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    const fx = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fx).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' });
    expect(night!.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
    expect(night!.rows.find((r) => r.job === 'notes/backup')!).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('an empty file is an empty night', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts off-shape lines instead of throwing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-02.jsonl'), '{"at":"x","job":"a","status":"weird","owner":null}\n[]\nnot json\n{"at":"x","job":"a","status":"ok","owner":null}\n');
    const n = readNight(dir, '2026-01-02')!;
    expect(n.badLines).toBe(3);
    expect(n.rows).toHaveLength(1);
  });
});
