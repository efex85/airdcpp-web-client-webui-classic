# AirDC++ Classic

The web UI of this image: a UI for [AirDC++ Web Client](https://airdcpp-web.github.io/) that looks and works like a
classic desktop DC client: menu bar, toolbar, window tabs at the bottom, sortable lists with right-click menus, a transfer
pane and a status bar. Dark theme. It talks to the daemon through its Web API; the system uptime and the syncing
between devices need two small daemon patches of this image.

Build image is available at https://hub.docker.com/r/rafsis/airdcpp-web-client-webui-classic

## What is included

| Window           | Highlights                                                                                                                                              |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| Home             | system statistics, RSS feeds and notes                                                                                                                  |
| Hubs             | chat with clickable magnet, release and web links, Tab nick completion, chat commands; password and redirect prompts                                    |
| User list        | operators/bots/users groups, column sorting and selection, filter, hub user commands                                                                    |
| Private messages | including the transport encryption state                                                                                                                |
| Search           | type, size and excluded words, hub selection, sources of grouped results, view a file or find the NFO of a folder                                       |
| File lists       | folder tree, download to favorite folders or any folder, item details, view files, Find NFO, own list per share profile, "Refresh in share"             |
| Viewed files     | text and NFO files, images, audio and video, one window each                                                                                            |
| Download queue   | priorities, pause and resume all, files and sources of a bundle, remove a user, rescan or force in share after a failed content check, remove completed |
| Transfers        | window and optional bottom pane; remove a file or a user from the queue                                                                                 |
| Favorite hubs    | add, connect and edit favorite hubs                                                                                                                     |
| System log       |                                                                                                                                                         |
| Settings         | see below                                                                                                                                               |

## Settings

Open them with the cog button in the toolbar or from the File menu. The pages follow the official web UI:
profile and away mode, speed and bandwidth limits, connectivity, downloads (favorite directories, search
types), sharing (shared folders, share profiles, hashing, excluded paths), notifications and view options,
extensions, web users, logging, web server, and statistics. Which pages are shown, and whether they can be
changed, depends on the permissions of the web user.

- Changes on a settings page take effect with **Save changes**. Lists (folders, profiles, users and so on)
  are changed right away through their dialogs.
- Settings that are detected automatically show the detected value and can't be edited until the detection is
  turned off. The detected values are not saved over the manual ones.
- The pages **Home and startup**, **Colors** and **Text and chat** under **View** apply changes immediately.
  What is synced and what belongs to one browser is listed under [Synced and per browser](#synced-and-per-browser).
- Popups appear inside the page. While the page is in the background the browser's own notifications are
  used instead, if you have allowed them; browsers only permit that over HTTPS or on localhost.
- Some settings of the daemon are only available through its API and are not included.

## Windows and tabs

- After logging in, **Home** is the first tab and is shown; **System log** is the second. Both can be turned off
  under **Settings → View → Home and startup** ("Show the Home tab", "Open the system log after logging in").
  A system log that isn't opened automatically is still available from the View menu, the toolbar and the status bar.
- **Drag a tab** to move it. Esc cancels. Once you have moved tabs, the order is kept after reloading and after
  logging in again, also if that puts Home or the system log somewhere else. A hub returns to its place when it's
  connected again; other windows that you open are added at the end. The order is stored in the browser.
  Dragging works with a mouse or a pen, not with a finger.
- The **×** at the top right closes the window that is shown. Windows can also be closed with the **×** on their
  tab, with a middle click on the tab, or from the tab's menu. Closing a connected hub asks first.
- Closing the shown window returns to the window that you used before it.

## Home

- **System stats**: system and client uptime, current speeds and running transfers, downloaded and uploaded
  this session and in total, share ratio, download queue, share size and connected hubs. Inside Docker the system
  uptime is normally that of the host machine.
- **RSS feed**: add as many as you like. Each has its own address, title and refresh interval, and a refresh
  button. Click an entry to open its link or to search for its title; the search starts at once. The client
  fetches the feeds, as in the official web UI.
- **Notes**: saved while typing, at most 60,000 characters each.

Add widgets with the buttons at the top; **⋮** on a widget changes or moves it, and **×** removes it.

**Height**: feeds and notes can be made taller under **⋮ → Height**: Normal, Tall (2 boxes) or Extra tall
(3 boxes). The boxes are placed from left to right, row by row, and a tall box also occupies the place below it.
With room for three columns, the order *A, B (tall), C, D, E* gives A and D stacked on the left, B in the middle
and C and E stacked on the right. Use **Move earlier** and **Move later** to change the order. The number of
columns depends on the width of the window; a phone shows one.

## Searching

A search window opened from a feed entry, "Search for alternates" and the like starts its search by itself. If no
hub is connected, it starts as soon as one is. Hubs limit how often one may search, so the client may have to
queue a search; the window then counts down until it is sent.

## Colors and text

- **Colors**: ready-made color sets, and your own colors for nicknames (yours, operators, bots, other, favorite
  and ignored users; also bold or not), chats, shared, queued and downloaded items, and the interface itself.
  The color for favorite users applies to users that are already favorites in the configuration of the client;
  this interface can't add favorite users.
- **Tab highlights**: how the tabs of chats are marked, see below.
- **Text and chat**: text size of the interface and of chats, chat font and timestamp format. List columns
  become wider or narrower with the text size.

## Tab highlights

Under **Settings → View → Tab highlights** each of these events can mark the tab of its chat or not, with its own
background color, text color and bold text. On a phone the entry in the list of windows is marked in the same way.

| Chat    | Event                                  | Marks by default | Colors until you set them         |
|---------|----------------------------------------|------------------|-----------------------------------|
| Hub     | My nick is mentioned                   | yes, bold        | its own, from the color set       |
| Hub     | Someone writes                         | yes              | its own, from the color set       |
| Hub     | A bot writes                           | yes              | as "Someone writes"               |
| Hub     | Status message                         | no               | as "Someone writes"               |
| Hub     | Joins, parts and other detail messages | no               | as "Someone writes"               |
| Private | Someone writes                         | yes, bold        | as a mention in a hub             |
| Private | A bot writes                           | yes, bold        | as "Someone writes" (private)     |
| Private | Status message                         | yes              | as "Someone writes" (hub)         |

- A tab is marked while another window is shown. If several events have happened, the first one in the table that
  is switched on decides how the tab looks.
- Joins and parts only count when the hub shows them in its chat.
- A marked mention or private message also puts "(*)" in the title of the page and gives the menu button on phones
  the color for mentions. Switching the event off removes these marks too. The two colors of that dot are chosen
  on the same page.
- The system log, file lists and viewed files use the colors of "My nick is mentioned" and "Someone writes".
- Notifications are not affected. They are set under **Settings → View → Notifications**.

## Synced and per browser

| Same on all devices of a web user                      | Stored in each browser                                                |
|--------------------------------------------------------|-----------------------------------------------------------------------|
| Home widgets, feeds and notes                          | text sizes, chat font, timestamps                                     |
| colors and tab highlights                              | notifications and the other browser settings                          |
| "Show the Home tab", "Open the system log …"           | tab order, column widths, pane sizes, whether the transfer pane shows |

Synced data is stored by the client in `WebUserData.json` in its configuration directory. It isn't encrypted.
If two devices change the same note before seeing each other's text, both versions are kept in the note. With a
client without the patch, everything is stored in the browser and the pages say so.

## Chat commands

`/me <message>`, `/clear` and `/help` are handled by the web UI. Every command, including `/me`, is also passed to
the client, so that extensions can react to it (for example the commands of `airdcpp-user-commands`). The client
doesn't send command text to the hub or to the other user. As in the official web UI, a command that nothing
handles does nothing.

## Refreshing the share

The refresh button of the toolbar rescans the whole share. Its arrow also offers the incoming folders and each
shared folder by its name in the file list; a name with several folders opens a submenu for choosing one of them
or all. The same choices are in the **File** menu (on a phone: menu button → File → Refresh folder). Single folders
can also be refreshed under **Settings → Sharing → Shared folders**. Refreshing requires the permission to edit
the share.

## Viewing files

Choose **View as text**, **View image**, **Play audio** or **Play video** from the menu of a file: in file lists,
search results and on magnet links in chats. A file that isn't in your own share is downloaded from the user first,
to a temporary file of the client. **Find NFO** in the menu of a folder looks up its NFO file and opens it; the user
needs a client that supports this kind of search.

- Text is offered for files smaller than 256 KiB, the other kinds for files smaller than 200 MiB, because the web
  server of the client reads a file into memory before sending it.
- Which audio and video formats play depends on the browser.
- The audio and video players get the file from an address that contains the login token of the session, as in the
  official web UI. Keep that in mind if a reverse proxy writes full addresses to its log.
- The web user needs the permission to view files.

## Download queue

- **Pause all** pauses every download. **Resume all** gives every download automatic priority again, which also
  replaces priorities that you have set by hand. To set one priority for several downloads, select them (Ctrl+A
  selects all) and use **Priority** in their menu.
- **Rescan for errors** and **Force in share** appear for downloads that failed the content check of an extension.
  The first runs the check again, the second accepts the download without it.
- **Remove user from queue** removes the user as a source from all queued files.

**Browse…** under **Download to** opens a folder browser that starts in the folder chosen last time. Web users who
may not browse the files of the server type the folder instead.

## Own file list

**Refresh in share** (menu of a file or folder, or the button next to the path) rescans a shared folder. New files
appear once the client has hashed them; use **Reload** if the list doesn't show them yet.

## Using the mouse and keyboard

- Right-click a row, hub tab or column header for its menu.
- Click, Ctrl+click and Shift+click select rows; the arrow, Home, End, Page Up and Page Down keys move the
  selection; Enter opens; Delete removes (where removing is possible); typing jumps to a name.
- Drag column edges and the borders between panes to resize them.

On a phone the layout changes to one window at a time. The menu button opens the window list and menus,
**⋮** opens the menu of a row and a long press starts selecting several rows.

## Development

Requires Node.js 22 and a running daemon.

```sh
npm ci
AIRDCPP_URL=http://127.0.0.1:5600 npm run dev    # development server, API requests go to the daemon
npm test                                          # unit tests
npm run build                                     # type check and production build in dist/
```

To use a build without Docker, start the daemon with `airdcppd --web-resources=/path/to/webui-classic/dist`.

Layout preferences and the browser settings are saved in the browser. With "Keep me logged in", the browser
also stores a token that signs you in again; logging out removes it.
