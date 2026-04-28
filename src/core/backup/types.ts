/**
 * Backup System Types
 */

/** Backup configuration */
export interface BackupConfig {
  /** Maximum number of full backups to retain */
  maxBackups: number;
  /** Directory to store backup archives */
  backupDirectory: string;
  /** Enable backup verification after creation */
  verifyAfterCreate: boolean;
}

/** Result of a backup operation */
export interface BackupResult {
  /** Whether the backup succeeded */
  success: boolean;
  /** Unique backup identifier (timestamp-based) */
  backupId: string;
  /** Path to the backup directory */
  backupPath: string;
  /** ISO timestamp when backup was created */
  createdAt: string;
  /** Counts of items backed up */
  counts: {
    questionnaires: number;
    responses: number;
    sessions: number;
  };
  /** Errors encountered (non-fatal) */
  errors: string[];
}

/** Result of a backup verification */
export interface BackupVerificationResult {
  /** Whether the backup is valid */
  valid: boolean;
  /** Backup identifier */
  backupId: string;
  /** Counts of verified items */
  counts: {
    questionnaires: number;
    responses: number;
    sessions: number;
  };
  /** Verification errors */
  errors: string[];
}

/** Result of a restore operation */
export interface RestoreResult {
  /** Whether the restore succeeded */
  success: boolean;
  /** Backup identifier that was restored */
  backupId: string;
  /** Counts of items restored */
  counts: {
    questionnaires: number;
    responses: number;
    sessions: number;
  };
  /** Errors encountered */
  errors: string[];
}

/** Backup manifest stored alongside backup data */
export interface BackupManifest {
  /** Backup format version */
  version: string;
  /** Backup identifier */
  backupId: string;
  /** ISO timestamp */
  createdAt: string;
  /** Source data directory */
  sourceDirectory: string;
  /** Counts */
  counts: {
    questionnaires: number;
    responses: number;
    sessions: number;
  };
}
