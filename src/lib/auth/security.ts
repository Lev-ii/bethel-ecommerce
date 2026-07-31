import "server-only";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  firstSeen: number;
  lockedUntil?: number;
}

const failedLogins = new Map<string, AttemptRecord>();

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeIp(value?: string | null): string {
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}

function keyFor(email: string, ip?: string | null): string {
  return `${normalizeEmail(email)}:${normalizeIp(ip)}`;
}

function prune(record: AttemptRecord, now: number): AttemptRecord | null {
  if (now - record.firstSeen > WINDOW_MS) {
    return null;
  }
  if (record.lockedUntil && now > record.lockedUntil) {
    return null;
  }
  return record;
}

export function isLoginBlocked(email: string, ip?: string | null): boolean {
  const now = Date.now();
  const record = failedLogins.get(keyFor(email, ip));
  if (!record) return false;

  const fresh = prune(record, now);
  if (!fresh) {
    failedLogins.delete(keyFor(email, ip));
    return false;
  }

  if (fresh.lockedUntil && now < fresh.lockedUntil) {
    return true;
  }

  if (fresh.count >= MAX_FAILURES) {
    fresh.lockedUntil = now + WINDOW_MS;
    return true;
  }

  return false;
}

export function recordFailedLogin(email: string, ip?: string | null) {
  const key = keyFor(email, ip);
  const now = Date.now();
  const existing = failedLogins.get(key);
  const record: AttemptRecord = existing
    ? prune(existing, now) ?? { count: 0, firstSeen: now }
    : { count: 0, firstSeen: now };

  if (now - record.firstSeen > WINDOW_MS) {
    record.count = 0;
    record.firstSeen = now;
    record.lockedUntil = undefined;
  }

  record.count += 1;
  if (record.count >= MAX_FAILURES) {
    record.lockedUntil = now + WINDOW_MS;
  }

  failedLogins.set(key, record);

  return {
    blocked: record.count >= MAX_FAILURES,
    remaining: Math.max(0, MAX_FAILURES - record.count),
  };
}

export function clearLoginAttempts(email: string, ip?: string | null): void {
  failedLogins.delete(keyFor(email, ip));
}
