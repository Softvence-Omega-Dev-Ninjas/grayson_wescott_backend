#!/bin/bash

# Zero Downtime Deployment Script (docker compose version)
# Usage: ./deploy.sh --version <version> | --rollback | status

set -euo pipefail

# ================================
# from GitHub secret
# ================================
PACKAGE_NAME="${PACKAGE_NAME:?PACKAGE_NAME not set}"
PACKAGE_VERSION="${PACKAGE_VERSION:?PACKAGE_VERSION not set}"
DOCKER_USERNAME="${DOCKER_USERNAME:?DOCKER_USERNAME not set}"
VPS_HOST_IP="${VPS_HOST_IP:?VPS_HOST_IP not set}"
PORT="${PORT:?PORT not set}"
BASE_URL="https://carbonengines.com"             
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-$BASE_URL/api/health}"  
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-15}"
HEALTH_RETRIES="${HEALTH_RETRIES:-5}"
VERSION_FILE="./deployment_versions.txt"

# ================================
# Colors
# ================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC} $*"; }

# ================================
# Helpers
# ================================
usage() {
  echo "Usage: $0 --version <version> | --rollback | status"
  exit 1
}

current_version() {
  [ -f "$VERSION_FILE" ] && tail -n1 "$VERSION_FILE" || echo "none"
}

previous_version() {
  [ -f "$VERSION_FILE" ] && tail -n 2 "$VERSION_FILE" | head -n1 || echo "none"
}

save_version() {
  echo "$1" >> "$VERSION_FILE"
  tail -n 10 "$VERSION_FILE" > "${VERSION_FILE}.tmp" && mv "${VERSION_FILE}.tmp" "$VERSION_FILE"
}

# Replace docker healthcheck with external curl check
health_check() {
  log "Waiting for API to respond at $HEALTH_ENDPOINT..."
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -fs --max-time "$HEALTH_TIMEOUT" "$HEALTH_ENDPOINT" | grep -q '"status":"ok"'; then
      ok "API is up and responding"
      return 0
    fi
    warn "Attempt $i/$HEALTH_RETRIES: not ready, retrying in 10s..."
    sleep 10
  done
  err "API did not respond in time"
  return 1
}

rollback() {
  local cur=$(current_version)
  local prev=$(previous_version)
  [ "$prev" = "none" ] && { err "No previous version"; return 1; }
  warn "Rolling back $cur → $prev"
  deploy "$prev"
}

deploy() {
  local image="${DOCKER_USERNAME}/${PACKAGE_NAME}:${PACKAGE_VERSION}"
  local cur=$(current_version)

  log "Deploying version $PACKAGE_VERSION (image=$image)"

  # If current version exists and is different from the new one, stop & remove it
  if [ "$cur" != "none" ] && [ "$cur" != "$PACKAGE_VERSION" ]; then
    warn "Removing old version $cur..."
    docker compose down || warn "Failed to stop old containers"
    docker rmi "${DOCKER_USERNAME}/${PACKAGE_NAME}:${cur}" || warn "Failed to remove old image"
  fi

  # Pull new image
  docker pull "$image" || warn "Image not in registry, skipping pull"

  # Recreate service with compose
  docker compose up -d --remove-orphans

  # Cleanup unused containers/images (but keep volumes)
  docker system prune -a -f

  sleep 5
  if health_check; then
    save_version "$PACKAGE_VERSION"
    ok "Deployment $PACKAGE_VERSION successful"
  else
    err "New version not responding, rolling back..."
    rollback
  fi
}

status() {
  echo "=== Deployment Status ==="
  echo "Current: $(current_version)"
  echo "Previous: $(previous_version)"
  echo "Containers:"
  docker compose ps
  echo "Health check via $HEALTH_ENDPOINT:"
  if curl -fs "$HEALTH_ENDPOINT" | grep -q '"status":"ok"'; then
    echo "✅ ok"
  else
    echo "❌ fail"
  fi
  [ -f "$VERSION_FILE" ] && { echo "History:"; tail -n5 "$VERSION_FILE" | nl -s'. '; }
}

# ================================
# CLI entrypoint
# ================================
case "${1:-}" in
  --version)
    [ -z "${2:-}" ] && usage
    deploy "$2"
    ;;
  --rollback)
    rollback
    ;;
  status)
    status
    ;;
  *)
    usage
    ;;
esac
