# AirDC++ Web Client WebUI-Classic

Prebuilt image available at https://hub.docker.com/r/rafsis/airdcpp-web-client-webui-classic

A Debian based Docker image of AirDC++ Web Client with:

1. **AirDC++ Classic**, a web UI that looks and works like a desktop client – `webui-classic/`.
   It is the only web UI of the image; the standard web UI is not included.
2. **Hub user commands** in the hub and user-list menus (what the Windows client shows when you
   right-click a hub or a user) – `daemon-hubcommands.patch`
3. **System uptime** on the Home page of the web UI – `daemon-system-uptime.patch`
4. **Syncing between devices** of the Home widgets, notes, colors and startup choices of the web UI –
   `daemon-user-data.patch`

## The web UI

- A classic desktop layout with a menu bar, toolbar, window tabs at the bottom, sortable lists and right-click
  menus. Dark theme, with a layout of its own for phones.
- Hubs, private messages, search, file lists, download queue, transfers, favorite hubs, system log, and viewing
  text, NFO, image, audio and video files.
- A **Home** window with system statistics, RSS feeds and notes. It can be turned off.
- Tabs can be rearranged by dragging them with a mouse or pen. Closing a window returns to the previous one.
- Your own colors and color sets, tab highlights per event, text sizes, chat font and timestamps.
- The toolbar refreshes the whole share, the incoming folders or a single shared folder.
- Chat commands are passed to the client, so extensions that add `/commands` can react to them.
- The settings of the official web UI.

Details are in [webui-classic/README.md](webui-classic/README.md).

## Build

You need Docker and an internet connection: the build fetches base images, Debian packages, the daemon source,
the npm packages of the web UI and Node.js (for extensions).

```sh
./build.sh
```

The script only **builds** an image in your local Docker. It does not upload it anywhere. The image is named
`airdcpp-web-client-webui-classic` and tagged with the date and time of the build, for example
`airdcpp-web-client-webui-classic:20260131-1845`. The script prints the name when it is done; no `latest` tag
is set.

The build runs with `--no-cache`: every step is done again, including compiling the daemon, so each build takes about
as long as the first one.

`IMAGE` and `TAG` can be set as environment variables to use another name or tag, for example
`TAG=test ./build.sh`.

## Run

An example `docker-compose.yml`. Replace `DATE-TIME` with the tag of the image that you built
(`docker images airdcpp-web-client-webui-classic` lists them):

```yaml
services:
  airdcpp:
    image: airdcpp-web-client-webui-classic:DATE-TIME
    environment:
      PUID: "1000"
      PGID: "1000"
    ports:
      - "5600:5600"        # web UI, HTTP
      - "5601:5601"        # web UI, HTTPS (self-signed certificate)
      - "21248:21248/tcp"  # incoming connections
      - "21248:21248/udp"  # incoming search results
      - "21249:21249/tcp"  # encrypted incoming connections
    volumes:
      - ./config:/.airdcpp
      - ./downloads:/Downloads
      - ./share:/Share
    restart: unless-stopped
```

```sh
mkdir -p config downloads share    # they must be writable for PUID and PGID
docker compose up -d
```

| Variable        | Meaning                                                                                   |
|-----------------|-------------------------------------------------------------------------------------------|
| `PUID`, `PGID`  | user and group that the client runs as, 101 or higher; required when started as root      |
| `UMASK`         | optional, for example `022`                                                               |
| `LOG_STARTUP`   | optional; any value prints what the start script does                                     |

The web UI is at `http://host:5600/`. The web UI is part of the image, so there is nothing to choose: the `WEBUI`
variable of earlier versions is no longer read. The old address `/classic/index.html` forwards to `/`.

### Login

With an empty configuration directory the container copies the defaults from `.airdcpp/`, which contain one web
user, `admin`, with administrator permissions. The file only holds a hash of its password. To set your own
password, run the commands below. When asked, enter `admin`, answer `y` and type the new password twice.

```sh
docker compose stop airdcpp
docker compose run --rm airdcpp --add-user
docker compose up -d
```

### Updating

Build a new image with `./build.sh`, put its tag in the `image:` line of `docker-compose.yml`, then:

```sh
docker compose up -d
```

Settings, web users and the synced data of the web UI are kept in the configuration directory.

## What is different from the plain build

Hub user commands, system uptime and syncing are **daemon** changes (C++). For the commands, the web UI asks the
daemon for the `hub` and `hub_user` menus, so they show up in its menus.
These changes mean the image **cannot use the official release tarball**: the Dockerfile builds the daemon from
source with the patches applied, and assembles the same layout as the official portable package
(`airdcppd`, `dcppboot.xml`, `web-resources/`).

| What         | Pinned to                                                                      |
|--------------|--------------------------------------------------------------------------------|
| Debian       | `distro` = `trixie-slim` (Debian 13), for building the daemon and for running  |
| Web UI build | `node:22-bookworm-slim` (Debian 12), only used while building                  |
| Daemon       | `daemon_ref` = `e330cf88…` (version string `2.14.1b-91`)                       |

The packages with the libraries that the daemon needs at runtime are not listed in the Dockerfile:
`list-runtime-deps.sh` looks them up after the build.

By default the git "modified working tree" suffix (`-d`) is left out of the version string. To add a suffix of
your own, use `docker build --build-arg version_suffix=-xl …`.

## System uptime

A web page can't ask the server for its uptime, and the daemon API only reports when the client was started.
`daemon-system-uptime.patch` adds `system_started` to the system information: the current time minus the first
number of `/proc/uptime`. Only logged-in users receive it. Inside a Docker container this is normally the uptime of
the **host machine**, as containers share its kernel. Without the patch the Home page leaves the line out.

## Syncing between devices

The daemon API has nowhere to keep data of a web UI, so `daemon-user-data.patch` adds it:

| Request                                | Does                                                                   |
|----------------------------------------|------------------------------------------------------------------------|
| `GET /api/v1/system/user_data/<key>`   | returns `{"revision", "value"}` (revision 0 = nothing stored)          |
| `POST /api/v1/system/user_data/<key>`  | stores `{"value", "revision"}`; `409` if the revision is out of date   |
| `DELETE /api/v1/system/user_data/<key>`| removes the value                                                      |
| `system` event `user_data_updated`     | tells the other sessions of the same user what changed                 |

- Every web user can only reach their own data. The data of a removed web user is deleted.
- It is saved in `WebUserData.json` in the configuration directory (`/.airdcpp`), so it survives container updates
  as long as that directory is kept. Include it in your backups. It is **not encrypted**.
- Limits: keys of letters, digits and `_` (at most 64), 256 KiB and 32 levels per value, 200 keys per user.

## How the hub commands behave

- Commands come from hubs (sent by the hub) and from the user's own saved commands, filtered for the hub
  exactly like the Windows client does (all hubs / a specific hub / `op` hubs, NMDC vs ADC).
- They appear in the hub menu (hub-context commands) and in the user menu in the user list (user-context
  commands). Names containing `/` become submenus.
- `%[line:Label]` and `%[kickline:Label]` prompts become input fields in a dialog. A prompt used more than
  once in a command asks only once. Fields may be left empty.
- Clicking sends the command through the daemon's own user command code (`sendUserCmd`), the same path
  the Windows client uses. The command id sent by the browser is re-checked against the commands that are
  actually available for that hub, so a forged id for another hub's command is ignored.

### Not included

- Search-result and filelist context commands (only the hub and user-list contexts are wired).
- Separators are skipped (the menu API has no separator item).

## Files

| File                          | Purpose                                                                |
|-------------------------------|------------------------------------------------------------------------|
| `Dockerfile`                  | web UI build → daemon build → runtime image                            |
| `webui-classic/`              | source of the web UI                                                   |
| `daemon-hubcommands.patch`    | daemon change: hub user commands (new `HubCommandMenuProvider`)        |
| `daemon-system-uptime.patch`  | daemon change: `system_started` in the system information              |
| `daemon-user-data.patch`      | daemon change: small per-user data store for the web UI                |
| `list-runtime-deps.sh`        | finds the runtime library packages during the build                    |
| `entrypoint.sh`, `.airdcpp/`  | container entrypoint and default config                                |
| `build.sh`                    | builds the image, without cache; uploads nothing                       |
| `daemon-extension-sha1.patch` | optional daemon fix, not applied by the Dockerfile (see below)         |

### The optional extension fix

The daemon writes the checksum of a downloaded extension with a wrong buffer size. Builds with a compiler
that checks buffer sizes by default (Ubuntu's, which earlier versions of this image used) abort the daemon
when an extension with a checksum is downloaded. `daemon-extension-sha1.patch` corrects the size. To apply
it, add after the other patch lines in the Dockerfile:

```dockerfile
COPY daemon-extension-sha1.patch /tmp/daemon-extension-sha1.patch
RUN git apply --check /tmp/daemon-extension-sha1.patch && git apply /tmp/daemon-extension-sha1.patch
```
