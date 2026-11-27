#!/bin/sh
# Builds the Debian based image (daemon and the Classic UI) from scratch, without the Docker layer cache.
# The image is tagged with the date and time of the build. It is not uploaded anywhere.
#
#   ./build.sh
#
# The name and the tag can be changed with environment variables, e.g.  TAG=test ./build.sh
set -eu

IMAGE="${IMAGE:-airdcpp-web-client-webui-classic}"
TAG="${TAG:-$(date +%Y%m%d-%H%M)}"

if [ "$#" -ne 0 ]; then
  echo "Usage: $0   (no options)" >&2
  exit 1
fi

cd "$(dirname "$0")"

# Everything that the Dockerfile reads from this folder
MISSING=""
for f in Dockerfile entrypoint.sh .airdcpp daemon-hubcommands.patch daemon-system-uptime.patch \
         daemon-user-data.patch daemon-emoticon-packs.patch list-runtime-deps.sh \
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

echo "==> Building $IMAGE:$TAG"

docker build --no-cache -t "$IMAGE:$TAG" .

echo "==> Done. Built $IMAGE:$TAG"
