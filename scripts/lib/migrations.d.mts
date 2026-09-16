export class MigrationError extends Error {}

export interface Migration {
  version: string;
  name: string;
  file: string;
  content: string;
  checksum: string;
}

export interface MigrationPlan {
  alreadyApplied: string[];
  baselined: string[];
  ran: string[];
}

export function readMigrations(dir: string): Migration[];

export function runMigrations(
  sql: unknown,
  options: {
    dir: string;
    table?: string;
    baseline?: string;
    legacyTable?: string | null;
    dryRun?: boolean;
  }
): Promise<MigrationPlan>;
