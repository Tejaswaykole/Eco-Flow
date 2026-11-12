# ECOFlow — Database Backup & Disaster Recovery Runbook

This guide outlines standard operational procedures for backup creation, automated point-in-time recovery (PITR), schema dump verification, and rollback execution for the ECOFlow production database.

---

## 1. Backup Strategy Overview

| Backup Type | Frequency | Retention | Purpose |
|---|---|---|---|
| **WAL Archiving (Continuous)** | Real-time | 30 days | Point-in-time recovery (PITR) to any second within 30 days. |
| **Physical Base Backup (`pg_basebackup`)** | Daily at 01:00 UTC | 30 days | Rapid full-cluster restore in disaster recovery scenarios. |
| **Logical Schema & Data Dump (`pg_dump`)** | Hourly | 7 days | Granular table/module restore and offline development baselines. |

---

## 2. Automated Logical Backup Script (`pg_dump`)

Create `/opt/ecoflow/scripts/backup_db.sh`:

```bash
#!/usr/bin/env bash
set -eo pipefail

BACKUP_DIR="/mnt/backups/ecoflow/logical"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="ecoflow_prod"
DB_USER="ecoflow_admin"
BACKUP_FILE="${BACKUP_DIR}/ecoflow_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting logical backup of ${DB_NAME}..."
pg_dump \
  -h 127.0.0.1 \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  -b \
  -v \
  -f "$BACKUP_FILE"

echo "[$(date)] Backup completed: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than 7 days
find "$BACKUP_DIR" -type f -name "ecoflow_*.dump" -mtime +7 -delete
echo "[$(date)] Old backups pruned successfully."
```

Make the script executable and schedule via cron (`crontab -e`):
```cron
0 * * * * /opt/ecoflow/scripts/backup_db.sh >> /var/log/ecoflow/backup.log 2>&1
```

---

## 3. Database Restore Procedures

### A. Restoring from Logical Dump (`pg_restore`)

To restore a specific backup file to a fresh or recovery database:

```bash
# 1. Terminate existing client connections
psql -h 127.0.0.1 -U ecoflow_admin -d postgres -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = 'ecoflow_prod' AND pid <> pg_backend_pid();
"

# 2. Re-create the database
psql -h 127.0.0.1 -U ecoflow_admin -d postgres -c "DROP DATABASE IF EXISTS ecoflow_prod;"
psql -h 127.0.0.1 -U ecoflow_admin -d postgres -c "CREATE DATABASE ecoflow_prod OWNER ecoflow_admin;"

# 3. Restore schema, data, triggers, and constraints using pg_restore
pg_restore \
  -h 127.0.0.1 \
  -p 5432 \
  -U ecoflow_admin \
  -d ecoflow_prod \
  -v \
  --single-transaction \
  /mnt/backups/ecoflow/logical/ecoflow_20261111_030000.dump
```

---

## 4. Rollback Scripts Reference

If a schema migration must be backed out, dedicated rollback scripts are provided in `database/sql/`. Rollbacks must be executed in strict reverse chronological order.

| Migration | Rollback Script | Target Effects |
|---|---|---|
| `013_business_modules.sql` | `013_rollback_business_modules.sql` | Drops work orders, quality inspections, PO lines, inventory transactions, and warehouses. |
| `011_engineering_change_notice.sql` | `011_rollback_engineering_change_notice.sql` | Drops ECN distributions, material dispositions, and ECN tables. |
| `010_engineering_change_request.sql` | `010_rollback_engineering_change_request.sql` | Drops ECR tables and relations. |
| `009_multi_level_bom_support.sql` | `009_rollback_multi_level_bom.sql` | Removes multi-level recursive triggers and sub-assembly references. |

> [!WARNING]
> Rolling back migrations drops all associated business records created under those modules. Always take a logical `pg_dump` before executing any rollback script.

