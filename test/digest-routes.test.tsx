import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestNight } from '../src/digest/types.js';

const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

const normal = [
  line('2026-11-01T01:00:00+01:00', 'zeta-sync', 'ok', 'ana'),
  line('2026-11-01T01:05:00+01:00', 'alpha-backup', 'retry', 'bo', 'timeout'),
  line('2026-11-01T01:10:00+01:00', 'alpha-backup', 'ok', 'bo'),
  line('2026-11-01T01:15:00+01:00', 'mid-report', 'fail', null, 'boom'),
].join('\n');

beforeAll(() => {
  writeFileSync(join(runsDir, '2026-11-01.jsonl'), normal + '\n');
  writeFileSync(join(runsDir, '2026-11-02.jsonl'), '');
  writeFileSync(join(runsDir, '2026-11-03.jsonl'), normal + '\nnot json at all\n');
});

const app = () => createApp(config);
const jobs = ['alpha-backup', 'mid-report', 'zeta-sync'];

describe('GET /digest/:night', () => {
  it('lists each job', async () => {
    const res = await app().request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const j of jobs) expect(html).toContain(j);
  });

  it('404 for a night with no file', async () => {
    expect((await app().request('/digest/2026-12-31')).status).toBe(404);
  });

  it('empty file says nothing ran', async () => {
    const res = await app().request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line still lists good jobs and says did not parse', async () => {
    const res = await app().request('/digest/2026-11-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const j of jobs) expect(html).toContain(j);
    expect(html).toContain('did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns rows sorted by job', async () => {
    const res = await app().request('/api/digest/2026-11-01');
    const body = (await res.json()) as DigestNight;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-11-01');
    expect(body.rows.map((r) => r.job)).toEqual(jobs);
    expect(body.badLines).toBe(0);
  });

  it('404 for a night with no file', async () => {
    expect((await app().request('/api/digest/2026-12-31')).status).toBe(404);
  });

  it('empty night has no rows and no bad lines', async () => {
    const body = (await (await app().request('/api/digest/2026-11-02')).json()) as DigestNight;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts the bad line', async () => {
    const res = await app().request('/api/digest/2026-11-03');
    const body = (await res.json()) as DigestNight;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
  });
});

describe('page and JSON agree', () => {
  it('job names appear in the page in the JSON row order', async () => {
    const html = await (await app().request('/digest/2026-11-01')).text();
    const body = (await (await app().request('/api/digest/2026-11-01')).json()) as DigestNight;
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
