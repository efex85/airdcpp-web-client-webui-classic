#!/bin/sh
# Prints the names of the installed packages that provide the shared libraries needed by the daemon that was
# installed under the given folder, one per line. The Dockerfile runs this in the build stage and installs
# exactly these packages in the final image, so no library package names have to be maintained by hand.
#
#   sh list-runtime-deps.sh /daemon-install
set -eu

ROOT="${1:?usage: list-runtime-deps.sh <install folder>}"
BINARY="$ROOT/usr/local/bin/airdcppd"
OWN_LIBS="$ROOT/usr/local/lib"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[ -x "$BINARY" ] || fail "$BINARY not found"

# ldd also lists the libraries that are needed indirectly
LIBS="$(LD_LIBRARY_PATH="$OWN_LIBS" ldd "$BINARY")" || fail "ldd failed"
case "$LIBS" in
  *"not found"*) fail "unresolved libraries:
$(printf '%s\n' "$LIBS" | grep 'not found')" ;;
esac

# The package database may know a file by its path with or without the /usr prefix (merged /usr)
package_of() {
  real="$(readlink -f "$1")"
  for path in "$1" "$real" "/usr$1" "${1#/usr}" "${real#/usr}"; do
    if found="$(dpkg-query -S "$path" 2>/dev/null)"; then
      # "package:architecture: /path" (diversion lines have other forms)
      printf '%s\n' "$found" | grep -v '^diversion ' | head -n 1 | cut -d: -f1
      return 0
    fi
  done
  return 1
}

PACKAGES=""
for lib in $(printf '%s\n' "$LIBS" | sed -n -e 's/.*=> \(\/[^ ]*\) .*/\1/p' -e 's/^[[:space:]]*\(\/[^ ]*\) .*/\1/p'); do
  # The daemon's own libraries are copied into the image, they don't come from a package
  case "$lib" in
    "$OWN_LIBS"/*) continue ;;
  esac
  package="$(package_of "$lib")" || fail "no package provides $lib"
  PACKAGES="$PACKAGES$package
"
done

[ -n "$PACKAGES" ] || fail "no libraries found"
printf '%s' "$PACKAGES" | sort -u
