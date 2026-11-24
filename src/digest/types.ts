// The contract every part of the digest works against (plan.md § 1). Readers fill it, views and
// the JSON route render it. Keep it small: one row per job, times as written in the log.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One parsed line of runs/<night>.jsonl. */
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One job's night, folded from all its lines. */
export type DigestRow = {
  job: string;
  /** `null` when the log says so; views show it as `—`. */
  owner: string | null;
  /** Lines for this job, any status. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** `error` of the last line that had one, or `null`. */
  lastError: string | null;
  /** `at` of the first and last line, offset kept as in the log. */
  firstAt: string;
  lastAt: string;
};

export type DigestNight = {
  night: string;
  /** Sorted by job. Empty when the file is empty. */
  rows: DigestRow[];
  /** Lines that did not parse. Counted, never thrown. */
  badLines: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Returns `null` when the night has no file (routes answer 404).
 * Never throws on bad lines.
 */
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
