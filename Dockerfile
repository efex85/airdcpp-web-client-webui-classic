# syntax=docker/dockerfile:1

# The image is based on Debian, for building and for running the daemon. The web UI is the Classic UI in
# webui-classic/. Build with ./build.sh, or:  docker build -t airdcpp-web-client-webui-classic .
# The release is named (rather than "stable-slim") so that a new Debian release doesn't change the build by itself.
ARG distro=trixie-slim

# --- Stage 1: build the web UI (its source is in this repository) ---
FROM node:22-bookworm-slim AS webui-build
WORKDIR /webui-classic
COPY webui-classic/package.json webui-classic/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY webui-classic/ ./
RUN npm run build

# --- Stage 2: build the daemon from source with the patches of this repository applied ---
# daemon-hubcommands.patch (hub user commands), daemon-system-uptime.patch (system uptime for the Home page),
# daemon-user-data.patch (syncing web UI data between devices), daemon-emoticon-packs.patch (emoticon packs from the
# configuration directory) and daemon-failed-connections.patch (failed transfers don't stay in the transfer list) were
# made against this exact upstream commit (2.14.1b-91) and are applied in this order.
FROM debian:${distro} AS daemon-build
ARG daemon_repo="https://github.com/airdcpp-web/airdcpp-webclient.git"
ARG daemon_ref="e330cf88efaeea67768630b5c888dfd989563cdc"

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential cmake git python3 pkg-config ca-certificates \
        libbz2-dev zlib1g-dev libssl-dev libminiupnpc-dev libnatpmp-dev libtbb-dev \
        libmaxminddb-dev libleveldb-dev nlohmann-json3-dev \
        libboost-dev libboost-regex-dev libboost-thread-dev libboost-system-dev \
    && rm -rf /var/lib/apt/lists/*

# A full clone is needed: the version string is generated with "git describe --tags"
WORKDIR /daemon
RUN git clone ${daemon_repo} . \
    && git checkout -q ${daemon_ref}

COPY daemon-hubcommands.patch /tmp/daemon-hubcommands.patch
RUN git apply --check /tmp/daemon-hubcommands.patch && git apply /tmp/daemon-hubcommands.patch
COPY daemon-system-uptime.patch /tmp/daemon-system-uptime.patch
RUN git apply --check /tmp/daemon-system-uptime.patch && git apply /tmp/daemon-system-uptime.patch
COPY daemon-user-data.patch /tmp/daemon-user-data.patch
RUN git apply --check /tmp/daemon-user-data.patch && git apply /tmp/daemon-user-data.patch
COPY daemon-emoticon-packs.patch /tmp/daemon-emoticon-packs.patch
RUN git apply --check /tmp/daemon-emoticon-packs.patch && git apply /tmp/daemon-emoticon-packs.patch
COPY daemon-failed-connections.patch /tmp/daemon-failed-connections.patch
RUN git apply --check /tmp/daemon-failed-connections.patch && git apply /tmp/daemon-failed-connections.patch

# The version string normally ends with the suffix that git adds to a modified tree ("-d", e.g. 2.14.1b-91-ge330-d).
# It is removed by default (empty), giving e.g. 2.14.1b-91-ge330. To add one, use --build-arg version_suffix=-xl
# (or edit the default here). Keep to letters, digits and "-":
# the version is also sent to hubs in the client tag, where characters like , < > $ | or spaces cause trouble.
ARG version_suffix=""
RUN grep -q -- '--dirty=-d' airdcpp-core/scripts/generate_version.py \
    && sed -i "s/--dirty=-d/--dirty=${version_suffix}/" airdcpp-core/scripts/generate_version.py

# This repository has its own web UI (stage 1), so skip the download of the standard one
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DINSTALL_WEB_UI=OFF -DCMAKE_INSTALL_PREFIX=/usr/local \
    && cmake --build build -j"$(nproc)" \
    && DESTDIR=/daemon-install cmake --install build --strip

# Which installed packages provide the shared libraries the daemon needs at runtime (installed in stage 3)
COPY list-runtime-deps.sh /tmp/list-runtime-deps.sh
RUN sh /tmp/list-runtime-deps.sh /daemon-install > /runtime-deps.txt \
    && cat /runtime-deps.txt

# --- Stage 3: the regular image ---
FROM debian:${distro}

# Runtime library packages, worked out in stage 2
COPY --from=daemon-build /runtime-deps.txt /tmp/runtime-deps.txt

# For builds that use the cache: a new value (--build-arg CACHEBUST=...) makes sure that the package/Node.js
# installation layer is not reused. build.sh builds without any cache.
ARG CACHEBUST=0

RUN installDeps=' \
        curl \
        gnupg \
    ' \
    && runtimeDeps=' \
        ca-certificates \
        locales \
        openssl \
        passwd \
        util-linux \
    ' \
# Install dependencies
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ${installDeps} ${runtimeDeps} $(cat /tmp/runtime-deps.txt) \
# Install node.js to enable airdcpp extension support.
# Pinned to the 18.x line before, which reached end-of-life in April 2025 —
# no more security backports land on it at all, which is why it was sitting
# on an old, unpatched build (including a 9.8-severity CVE). 24.x is a
# currently-maintained line, and its newer bundled npm also carries patched
# versions of tar/minimatch/http-cache-semantics.
    && curl -sL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && echo "Package install (build ${CACHEBUST})" \
# Cleanup
    && apt-get purge --autoremove -y ${installDeps} \
    && rm -f /tmp/runtime-deps.txt \
    && rm -rf /var/lib/apt/lists/*

# Configure locale
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
RUN echo 'en_US.UTF-8 UTF-8' >> /etc/locale.gen \
    && locale-gen \
    && locale -a | grep -qix 'en_US.utf8'

# The daemon built in stage 2, laid out like the official portable package:
#   /airdcpp-webclient/airdcppd, dcppboot.xml (portable mode, config in ./config) and web-resources/
# The shared libraries (airdcpp, airdcpp-webapi) are in /usr/local/lib, which the binary has as its runpath.
COPY --from=daemon-build /daemon-install/usr/local/lib/ /usr/local/lib/
COPY --from=daemon-build /daemon-install/usr/local/bin/airdcppd /airdcpp-webclient/airdcppd
COPY --from=daemon-build /daemon/buildroot/resources/dcppboot.xml /airdcpp-webclient/dcppboot.xml
RUN ldconfig

# The web UI
COPY --from=webui-build /webui-classic/dist/ /airdcpp-webclient/web-resources/

# Create default directories
RUN mkdir -p /.airdcpp /Downloads /Share \
    # Set permission on default directories
    && chmod a+rwX /.airdcpp /Downloads /Share \
    # Create symlink to configuration directory
    && ln -sf /.airdcpp /airdcpp-webclient/config

COPY .airdcpp/ /.default-config
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 5600 5601 21248 21249
ENTRYPOINT ["/entrypoint.sh"]
