#!/usr/bin/env bash
# Installs a version of the otr.to TURN relay on the VPS, as root.
#   install.sh <directory with the contents of turn/> <version name>
# coturn comes from the distribution; a version is its configuration and the systemd unit. Every
# version gets its own directory, /opt/otr-turn/current points to the running one. If the new
# version hands out no allocation, the previous one comes back.
# Other services on the VPS are left alone: this only touches /opt/otr-turn, otr-turn.service, the
# coturn package with its own coturn.service (kept masked) and, if ufw is on, the relay's ports.
set -euo pipefail

SRC=${1:?source directory missing}
VERSION=${2:?version name missing}
BASE=${OTR_TURN_BASE:-/opt/otr-turn}
UNIT_DIR=${OTR_TURN_UNIT_DIR:-/etc/systemd/system}
SERVICE=otr-turn
KEEP=3

fail() {
  echo "Error: $*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || fail "please run as root"
[[ $VERSION =~ ^[A-Za-z0-9._-]+$ ]] || fail "invalid version name: $VERSION"
for file in turnserver.conf "deploy/$SERVICE.service" deploy/healthcheck.py; do
  [ -f "$SRC/$file" ] || fail "$SRC/$file is missing"
done

setting() {
  sed -n "s/^$1=//p" "$SRC/turnserver.conf" | head -n 1
}
port=$(setting listening-port)
port=${port:-3478}
relay_ports="$(setting min-port):$(setting max-port)"

# The package brings coturn.service, which runs /etc/turnserver.conf on the same port. Masked, it
# neither starts on install nor on upgrades. One that already runs belongs to someone else.
if systemctl is-active --quiet coturn.service && [ "$(systemctl is-enabled coturn.service 2>/dev/null)" != masked ]; then
  fail "coturn.service is running and holds port $port, stop it first if nothing needs it"
fi
systemctl mask --quiet coturn.service
if ! command -v turnserver >/dev/null; then
  command -v apt-get >/dev/null || fail "coturn is missing"
  # Fresh cloud images ship without package lists. Wait for a deploy of the other service, should
  # it be installing packages right now.
  apt-get -o DPkg::Lock::Timeout=300 update -qq
  DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=300 install -y -qq coturn
fi

# Only if ufw is on: open what the relay needs, ufw skips rules it has already
if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow "$port/udp" comment "$SERVICE" >/dev/null
  ufw allow "$port/tcp" comment "$SERVICE" >/dev/null
  ufw allow "$relay_ports/udp" comment "$SERVICE relay" >/dev/null
fi

release="$BASE/releases/$VERSION"
previous=$(readlink "$BASE/current" 2>/dev/null || true)
# Rebuilding the running version would delete it under the service, with nothing to roll back to
[ "$release" != "$previous" ] || fail "version $VERSION is running already, pick a new version name"
echo "Installing $release"
mkdir -p "$BASE/releases"
rm -rf "$release"
mkdir "$release"
# Without -a: files belong to root, not to the user who uploaded them
cp -R "$SRC/." "$release/"

activate() {
  ln -sfn "$1" "$BASE/current.tmp"
  mv -T "$BASE/current.tmp" "$BASE/current"
  # The unit names /opt/otr-turn, follow OTR_TURN_BASE if it points elsewhere
  sed "s|/opt/otr-turn/|$BASE/|g" "$1/deploy/$SERVICE.service" > "$UNIT_DIR/$SERVICE.service"
  chmod 644 "$UNIT_DIR/$SERVICE.service"
  # Failures here must not skip the health check and the rollback below
  systemctl daemon-reload || echo "Warning: systemctl daemon-reload failed" >&2
  systemctl enable --quiet "$SERVICE" || echo "Warning: systemctl enable failed" >&2
  systemctl restart "$SERVICE" || echo "Warning: systemctl restart failed" >&2
}

healthy() {
  # The check of the new version also judges the rollback, with the credentials of what runs
  local out=""
  for _ in $(seq 1 20); do
    if out=$(python3 "$release/deploy/healthcheck.py" "$BASE/current/turnserver.conf" 2>&1); then
      [ -z "$out" ] || echo "$out" >&2
      return 0
    fi
    sleep 0.5
  done
  echo "$out" >&2
  return 1
}

activate "$release"
if ! healthy; then
  echo "Version $VERSION hands out no allocation on port $port" >&2
  journalctl -u "$SERVICE" -n 30 --no-pager >&2 || true
  if [ -n "$previous" ] && [ "$previous" != "$release" ] && [ -d "$previous" ]; then
    echo "Rolling back to $previous" >&2
    activate "$previous"
    if healthy; then echo "The previous version is running again." >&2; else echo "The previous version does not answer either." >&2; fi
  fi
  exit 1
fi

# Remove old versions, the running one always stays. Version names are checked above, so ls is fine.
current=$(readlink "$BASE/current")
# shellcheck disable=SC2012
ls -1dt "$BASE"/releases/*/ | sed 's:/$::' | { grep -vxF "$current" || true; } | tail -n +"$KEEP" | xargs -r rm -rf
echo "Version $VERSION relays on port $port."
