#!/usr/bin/env bash
# Docker cleanup script – safe reclaim of disk space
# Usage: ./scripts/docker-cleanup.sh [--with-volumes] [--dry-run]
# Do not prune volumes by default (preserves postgres_data, mongodb_data, etc.)

set -e

DRY_RUN=false
PRUNE_VOLUMES=false

for arg in "$@"; do
  case "$arg" in
    --with-volumes) PRUNE_VOLUMES=true ;;
    --dry-run)     DRY_RUN=true ;;
    -h|--help)
      echo "Usage: $0 [--with-volumes] [--dry-run]"
      echo "  --with-volumes  Also prune unused volumes (WARNING: can remove data if no container uses them)"
      echo "  --dry-run       Print what would be done without running prune"
      exit 0
      ;;
  esac
done

run() {
  if "$DRY_RUN"; then
    echo "[DRY-RUN] $*"
  else
    "$@"
  fi
}

echo "=== Docker disk usage (before) ==="
docker system df

echo ""
echo "=== 1. Removing stopped containers ==="
run docker container prune -f

echo ""
echo "=== 2. Removing dangling images (untagged) ==="
run docker image prune -f

echo ""
echo "=== 3. Removing unused images (not used by any container, older than 7 days) ==="
run docker image prune -a -f --filter "until=168h"

echo ""
echo "=== 4. Removing unused networks ==="
run docker network prune -f

echo ""
echo "=== 5. Removing build cache ==="
run docker builder prune -f

if "$PRUNE_VOLUMES"; then
  echo ""
  echo "=== 6. Removing unused volumes (WARNING: may remove data volumes if no container references them) ==="
  run docker volume prune -f
else
  echo ""
  echo "=== 6. Skipping volume prune (use --with-volumes to include; use with care) ==="
fi

echo ""
echo "=== Docker disk usage (after) ==="
docker system df

echo ""
echo "Done. Reclaimed space is shown above."
