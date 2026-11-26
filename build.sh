#!/bin/sh
# Builds the Debian based image (daemon and the Classic UI), tagged with the date and
# time of the build and as "latest". The image stays local; nothing is pushed.
#
#   ./build.sh
#
# The defaults can be changed with environment variables, e.g.  IMAGE=test ./build.sh
set -eu

IMAGE="${IMAGE:-airdcpp-web-client-webui-classic}"
TAG="${TAG:-$(date +%Y%m%d-%H%M)}"

cd "$(dirname "$0")"

# Everything that the Dockerfile reads from this folder
MISSING=""
for f in Dockerfile entrypoint.sh .airdcpp daemon-hubcommands.patch daemon-system-uptime.patch \
         daemon-user-data.patch list-runtime-deps.sh \
         webui-classic/package.json webui-classic/package-lock.json webui-classic/index.html webui-classic/src; do
  [ -e "$f" ] || MISSING="$MISSING $f"
done
if [ -n "$MISSING" ]; then
  echo "ERROR: these files are missing in $(pwd):" >&2
  for f in $MISSING; do echo "  $f" >&2; done
  echo "Use a complete copy of the project." >&2
  exit 1
fi

# An older Dockerfile would build something else
if ! grep -q 'list-runtime-deps' Dockerfile || ! grep -q 'webui-classic' Dockerfile; then
  echo "ERROR: this is an old Dockerfile. Use the one that belongs to this version of the project." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: cannot talk to Docker. Is it installed and running, and may this user use it?" >&2
  exit 1
fi

NAME="$IMAGE"

echo "==> Building $NAME:$TAG (also :latest)"

# CACHEBUST only affects the final stage (package/Node.js install), so the slow daemon compile
# is reused from the Docker layer cache when the Dockerfile and patches haven't changed.
docker build \
  --build-arg CACHEBUST="$(date +%s)" \
  -t "$NAME:$TAG" \
  -t "$NAME:latest" .

echo "==> Done. Built $NAME:$TAG and $NAME:latest"
