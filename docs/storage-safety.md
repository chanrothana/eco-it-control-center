# Storage Safety

This app still uses file-based storage, but it can be run more safely if production data is moved off the code directory and backups are mirrored to a second path.

## Recommended Production Layout

- Primary data root: persistent disk mount
- Secondary backup mirror: separate mounted path or synced folder
- App code: normal deploy directory only

Example layout:

- `DATA_ROOT=/var/data/eco-it-control-center`
- `DB_PATH=db.json`
- `SQLITE_PATH=data.sqlite`
- `UPLOADS_DIR=uploads`
- `BACKUPS_DIR=backups`
- `DB_MIRROR_PATH=/var/backup/eco-it-control-center/db-mirror.json`
- `BACKUP_MIRROR_DIR=/var/backup/eco-it-control-center/backups`
- `AUTO_BACKUP_ENABLED=true`
- `AUTO_BACKUP_INTERVAL_HOURS=24`
- `AUTO_BACKUP_RETENTION_DAYS=30`
- `BACKUP_COMPRESS=true`

## What The Server Does

- Writes `db.json` atomically
- Optionally mirrors the normalized DB to `DB_MIRROR_PATH`
- Creates JSON backups in `BACKUPS_DIR`
- Optionally creates `.json.gz` backup copies
- Optionally mirrors each backup into `BACKUP_MIRROR_DIR`
- Logs warnings at startup when storage still lives inside the app directory

## Render Setup

1. Attach a persistent disk to the web service.
2. Set `DATA_ROOT` to a path on that disk.
3. Set `BACKUP_MIRROR_DIR` to a second path that is not the same as `BACKUPS_DIR`.
4. Set `DB_MIRROR_PATH` to a mirrored JSON snapshot path.
5. Redeploy.

## Important Limitation

This is still file-based storage. The safer long-term target is:

- managed Postgres for structured data
- object storage for uploads
- scheduled off-instance backups
