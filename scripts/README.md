# Scripts

## docker-cleanup.sh

Safe Docker cleanup to reclaim disk space. Does **not** remove volumes by default (keeps `postgres_data`, `mongodb_data`, etc.).

**Run from repo root:**
```bash
./scripts/docker-cleanup.sh
```

**Options:**
- `--dry-run` – show what would be run without executing
- `--with-volumes` – also prune unused volumes (use with care; can remove data)
- `-h`, `--help` – show usage

**What it prunes:**
1. Stopped containers  
2. Dangling (untagged) images  
3. Unused images older than 7 days  
4. Unused networks  
5. Build cache  
6. Unused volumes only if `--with-volumes` is set  

**Cron (optional):** run weekly, e.g. `0 3 * * 0 /var/www/heyypal_backend/scripts/docker-cleanup.sh >> /var/log/docker-cleanup.log 2>&1`
