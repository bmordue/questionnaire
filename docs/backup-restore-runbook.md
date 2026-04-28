# Backup & Restore Runbook

## Overview

The questionnaire application includes an automated backup system that creates
full snapshots of all data (questionnaires, responses, and sessions). Backups
are stored as JSON files in a configurable directory and can be verified and
restored programmatically.

## Data Requiring Backups

| Data Type        | Location               | Description                          |
|------------------|------------------------|--------------------------------------|
| Questionnaires   | `data/questionnaires/` | Question set definitions             |
| Responses        | `data/responses/`      | User answers and completion state    |
| Sessions         | `data/sessions/`       | Active session tracking              |

## Backup Architecture

Each backup is a self-contained directory:

```
backups/
  backup-<timestamp>/
    manifest.json          # Metadata and item counts
    questionnaires/        # All questionnaire definitions
      <id>.json
    responses/             # All responses
      <sessionId>.json
    sessions/              # All active sessions
      <sessionId>.json
```

The **manifest** records:
- Format version
- Backup ID (timestamp-based)
- Creation timestamp (ISO 8601)
- Source data directory
- Exact counts of each item type

## Configuration

```typescript
import { BackupConfig } from './src/core/backup/index.js';

const config: BackupConfig = {
  intervalMs: 3600000,       // 1 hour between automatic backups
  maxBackups: 10,            // Retain the 10 most recent backups
  backupDirectory: './backups',
  verifyAfterCreate: true,   // Verify integrity after each backup
};
```

| Setting            | Default  | Description                                    |
|--------------------|----------|------------------------------------------------|
| `intervalMs`       | —        | Milliseconds between scheduled backups         |
| `maxBackups`       | —        | Number of backups to keep (oldest pruned)       |
| `backupDirectory`  | —        | Filesystem path for backup storage             |
| `verifyAfterCreate`| `true`   | Run verification immediately after backup      |

## Creating a Manual Backup

```typescript
import { BackupService } from './src/core/backup/index.js';
import { createStorageService } from './src/core/storage.js';

const storage = await createStorageService();
const backupService = new BackupService(storage, {
  intervalMs: 0,
  maxBackups: 10,
  backupDirectory: './backups',
  verifyAfterCreate: true,
});

const result = await backupService.createBackup();
console.log(result);
// { success: true, backupId: 'backup-1714300178000', counts: { ... }, ... }
```

## Scheduling Automated Backups

```typescript
import { BackupService, BackupScheduler } from './src/core/backup/index.js';

const scheduler = new BackupScheduler(backupService, 3600000); // hourly
scheduler.start();

// Stop when shutting down
scheduler.stop();
```

The scheduler:
- Runs backups at the configured interval
- Skips a scheduled run if a previous backup is still in progress
- Logs success/failure to the console
- Can be triggered immediately via `scheduler.triggerNow()`

## Verifying a Backup

```typescript
import { verifyBackup } from './src/core/backup/index.js';

const result = await verifyBackup('./backups/backup-1714300178000');
if (result.valid) {
  console.log('Backup is valid:', result.counts);
} else {
  console.error('Verification failed:', result.errors);
}
```

Verification checks:
1. Manifest exists and contains required fields
2. Every `.json` file in each subdirectory is parseable
3. Actual file counts match the manifest counts

## Restoring from a Backup

> **Warning**: Restoring will overwrite existing data for any items whose IDs
> match those in the backup. Create a fresh backup before restoring.

```typescript
import { RestoreService } from './src/core/backup/index.js';
import { createStorageService } from './src/core/storage.js';

const storage = await createStorageService();
const restoreService = new RestoreService('./backups');

const result = await restoreService.restoreFromBackup('backup-1714300178000', storage);
if (result.success) {
  console.log('Restore complete:', result.counts);
} else {
  console.error('Restore errors:', result.errors);
}
```

Restore process:
1. Reads the backup manifest
2. Restores questionnaires via `StorageService.saveQuestionnaire()`
3. Restores responses via `StorageService.saveResponse()`
4. Restores sessions by writing files directly to the sessions directory

## RPO / RTO

| Metric | Target   | How Achieved                                      |
|--------|----------|---------------------------------------------------|
| RPO    | ≤ 1 hour | Automated hourly backups (configurable)            |
| RTO    | < 5 min  | Single-command restore from most recent backup     |

- **RPO** (Recovery Point Objective): Data loss is bounded by the backup
  interval. Per-write backups in the storage layer provide additional
  protection between full backups.
- **RTO** (Recovery Time Objective): Restore reads JSON files and writes them
  through the storage service. For typical data volumes this completes in
  seconds.

## Backup Retention

Old backups are automatically pruned when the count exceeds `maxBackups`.
Oldest backups are deleted first. You can also delete a specific backup:

```typescript
await backupService.deleteBackup('backup-1714300178000');
```

## Listing Available Backups

```typescript
const backups = await backupService.listBackups();
// Returns BackupManifest[] sorted newest-first
```

## Troubleshooting

| Symptom                          | Likely Cause                     | Resolution                                  |
|----------------------------------|----------------------------------|---------------------------------------------|
| Backup returns `success: false`  | Storage service unavailable      | Check data directory permissions             |
| Verification count mismatch      | Files modified during backup     | Re-run backup; consider stopping writes      |
| Restore fails for some items     | Invalid JSON in backup files     | Verify backup first; use a different backup  |
| Scheduler not triggering         | `start()` not called             | Ensure scheduler is started after creation   |
