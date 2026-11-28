# AirDC++ Classic

The web UI of this image: a UI for [AirDC++ Web Client](https://airdcpp-web.github.io/) that looks and works like a
classic desktop DC client: menu bar, toolbar, window tabs at the bottom, sortable lists with right-click menus, a transfer
pane and a status bar. Dark theme. It talks to the daemon through its Web API; the system uptime, the syncing
between devices, the emoticon packs and ADL Search need daemon patches of this image (see the
[main README](../README.md), which also describes its other daemon changes).

## What is included

| Window           | Highlights                                                                                                                                                         |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Home             | system information, RSS feeds and notes                                                                                                                            |
| Hubs             | chat with clickable magnet, release and web links, Tab nick completion, chat commands; password and redirect prompts                                               |
| User list        | operators/bots/users groups, column sorting and selection, filter, hub user commands                                                                               |
| Private messages | including the transport encryption state                                                                                                                           |
| Search           | type, size and excluded words, hub selection, sources of grouped results, view a file or find the NFO of a folder                                                  |
| File lists       | folder tree, filter, **Match ADL**, download to favorite folders or any folder, item details, view files, Find NFO, own list per share profile, "Refresh in share" |
| Viewed files     | text and NFO files (with working links), images, audio and video, one window each                                                                                  |
| Download queue   | priorities, pause and resume all, files and sources of a bundle, remove a user, rescan or force in share after a failed content check, remove completed            |
| Transfers        | window and optional bottom pane; remove a file or a user from the queue                                                                                            |
| ADL Search       | searches that are matched against file lists                                                                                                                       |
| Favorite hubs    | add, connect and edit favorite hubs                                                                                                                                |
| System log       |                                                                                                                                                                    |
| Settings         | see below                                                                                                                                                          |

## Settings

Open them with the cog button in the toolbar or from the File menu. The pages follow the official web UI:
profile and away mode, speed and bandwidth limits, connectivity, downloads (favorite directories, search
types), sharing (shared folders, share profiles, hashing, excluded paths), notifications and view options,
extensions, web users, logging, web server, and statistics. Which pages are shown, and whether they can be
changed, depends on the permissions of the web user.

- Changes on a settings page take effect with **Save changes**; **Undo** drops them. Leaving a page or closing the
  window with unsaved changes asks first. This is the same on every page with settings, also on those under
  **View**. Lists (folders, profiles, users and so on) are changed right away through their dialogs, and buttons
  such as "Detect now" or "Pause" act at once.
- **Home and startup**, **Colors**, **App icon**, **Tab highlights**, **Emoji** and **Shortcuts** are synced between your
  devices. If one of these pages is changed on another device while you edit it, the change appears on your page; where both changed
  the same thing, yours stays and is what **Save changes** stores.
- **Search settings**, the box at the top, finds pages and settings by name. Every word has to match, in the name
  of the setting, its explanation or the name of its page. Click a result to open the page; the setting is scrolled
  into view and marked for a moment. Enter opens the first result and Esc clears the box. Only pages that you are
  allowed to see are searched. Settings of extensions (**Configure**) and the entries of lists aren't searched.
- Settings that are detected automatically show the detected value and can't be edited until the detection is
  turned off. The detected values are not saved over the manual ones.
- What is synced and what belongs to one browser is listed under [Synced and per browser](#synced-and-per-browser).
- Popups appear inside the page. While the page is in the background the browser's own notifications are
  used instead, if you have allowed them; browsers only permit that over HTTPS or on localhost.
- Some settings of the daemon are only available through its API and are not included.

## Windows and tabs

- With "Keep me logged in", opening the page shows **Signing in…** instead of the login form, so that password
  managers find no fields to fill in. The form appears if the saved login is no longer accepted. If signing in takes
  more than five seconds, a button offers the form.
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
- On larger screens the **title bar** at the top names the window that is shown, as the Windows client does. For a
  hub it is described under [Hub title and topic](#hub-title-and-topic).

## Hub title and topic

The title bar of a hub window shows the name of the hub, *AirDC++ | Hub name*. The **topic** is shown at the top of the
hub chat, just below the toolbar, level with the column headings of the user list.

- The topic is the description that the hub sends. A changed topic is shown as soon as the hub sends it, and the last
  one stays while the hub is disconnected (until the page is reloaded). A hub without a topic has no such line. It is
  shown as plain text.
- A topic that doesn't fit is cut off. Hover over it to read all of it, or **click it** to open it over more lines and
  click again to close it. You can mark it with the mouse to copy it.
- Hover over the **tab** of a hub to see its address, its connection state and the topic. The lock below the hub
  window shows whether the connection is encrypted.
- On a **phone** the topic is at the top of the chat as well. Tap it to read all of it.

## Home

- **System information**, from top to bottom: system and client uptime; current speeds, running transfers,
  downloaded and uploaded this session and in total, the ratio (ul/dl) and the download queue; the
  [IPv4 and IPv6 address](#ip-addresses), connected hubs and share size; disk space; hashing. Inside Docker the
  system uptime is normally that of the host machine. Its text can be [marked and copied](#copying).
- **RSS feed**: add as many as you like. Each has its own address, title and refresh interval, and a refresh
  button. Click an entry to open its link or to search for its title; the search starts at once. The client
  fetches the feeds, as in the official web UI.
- **Notes**: saved while typing, at most 60,000 characters each.
- **Recent PMs**: the private chats that were opened last, newest first, with the hub (or *Offline*) and the time
  they were opened. Chats that are open now are marked *Open*. Click one to show it or to open it again.
- **Recent searches**: the words you searched for last, newest first. Click one to search for it again, with the
  default search options.

**+ Add widget** at the top lists the available widgets; of System information, Recent PMs and Recent searches there
is only one each. A new widget is put in the highest free place. **⋮** on a widget changes it, and **×** removes it.

### Widget places

On larger screens every widget **stays where it is**. In a wider window nothing moves or grows, and the extra room
stays empty on the right. In a window that is too narrow for the arrangement, it is shown with narrower widgets.
Only when a widget would become too narrow to use are they stacked in one column; they return to their places when
the window is wide enough again.

- **Drag a widget by its title bar** to move it, with a mouse, a pen or a finger. The others make way, and widgets
  move up into free room above them. Dragging towards the top or bottom of the window scrolls. Esc cancels.
- With the keyboard, move to the icon at the left of the title and use the arrow keys.
- **⋮ → Arrange to fit this window** arranges the widgets anew for the present width of the window, in their present
  order. Use it after moving to a much wider or narrower screen.

Places are **stored in each browser**: every computer or browser has its own arrangement. The first time, the
widgets are placed from left to right, row by row; if widgets have already been rearranged in some browser, a new
one places them column by column in that order.

**Phones** show one widget below the other, in the order of the columns on the large screen: the first column from
top to bottom, then the next one. That order is the same on all devices, and follows the computer whose widgets were
rearranged most recently. Opening Home on a computer for the first time sets it too, unless widgets have already
been rearranged somewhere. On a phone, and where the widgets are stacked, **⋮ → Move up** and **Move down** change
the order; this doesn't move widgets that already have places on a computer.

### Widget sizes

On larger screens, **drag a bottom corner** of a widget to change its width and height; both corners work. A width
changes in steps of a quarter of a normal box, from half a box (System information: three quarters) up to the whole
window, and a height in steps of 10 pixels. The side opposite the corner stays where it is, so to widen a widget at
the right edge of the window, use its left corner. Widgets below make way. Dragging towards the bottom of the window
scrolls. With the keyboard, move to the bottom right corner and use the arrow keys.

**⋮ → Height** gives a widget one of three heights, Normal, Tall (2 boxes) or Extra tall (3 boxes); all widgets except
System information have it. **⋮ → Reset size** returns a widget to the normal size.

Sizes are **stored in each browser** and are not synced: every computer or browser has its own. Widgets and their
content are still the same everywhere. Heights that earlier versions saved for all devices are used until a widget
gets another size in that browser.

A normal box is as wide as an equal share of the window that the widgets were first placed or last arranged in (as
many side by side as fit at least 380 pixels wide). It is at least a normal height, or as high as System information
needs; with all its sections that is a little higher, and more so with large text or several disks. Once you resize
System information, the other boxes keep the height they had. **Reset size** on it lets them follow it again.

On a **phone** the boxes size themselves: each is as high as its content, at most the normal height (System
information as high as it needs), and longer feeds, notes and lists scroll inside their box. Chosen sizes don't
apply there.

### IP addresses

The lines **IPv4 address** and **IPv6 address** show the first of these that applies:

| Shown                          | When                                                                                    |
|--------------------------------|-----------------------------------------------------------------------------------------|
| **Disabled**                   | the protocol is switched off under **Settings → Connectivity**                          |
| **Disabled by auto detection** | the automatic detection switched it off (IPv6: no public IPv6 address was found)         |
| an address                     | the one that your connected hubs report for you; several if they report different ones  |
| an address                     | otherwise the external address that the client uses (set by hand or found through UPnP) |
| **Not known**                  | none of the above, for example while no hub is connected                                |

Hover over a line to see where it comes from, or why there is no address. Not every hub reports addresses (NMDC hubs
only with the UserIP feature). The lines are refreshed when a hub connects or disconnects, and every 30 seconds.
Knowing whether a protocol is disabled needs the permission to view the settings, and the addresses that hubs report
the permission to view the hubs; with neither, the lines are left out.

### Copying

Mark text in System information with the mouse, or by touching and holding on a phone, and copy it with your keyboard
or the menu of the browser. While
text of the box is marked, its figures stand still so that the mark isn't lost; they continue once you click
elsewhere. The buttons keep working.

### Hashing and disk space

**Hashing** shows the speed and the time left, the files and the amount of data left, and how far the client has
come with what is queued. Its buttons are at the bottom right of the widget, below the progress bar; they stay
there in a box that you made higher or lower. **Pause** takes effect when the current file is done; **Resume**
continues. The client also pauses hashing by itself while it refreshes the share. **Stop** asks first and then
empties the hashing queue; a later share refresh adds the files again. The section needs the permission to view the
share, and the buttons the permission to edit it.

**Disk space** shows the free and total space for the download folder and the shared folders (the latter with the
permission to view the share). The bar turns red when less than a tenth is free. The client doesn't tell which disk
a folder is on, so folders that report the same size and free space share a line; hover over it to see their paths.
In Docker, folders on one disk of the host therefore normally appear together. A folder that is missing shows the
numbers of the disk where its path would be.

### Recent PMs and searches

Both lists are kept by the client, so they are the same on all devices, and also for all web users of the client.
The client keeps 15 private chats and 10 searches unless you change that under **Settings → View → Histories** (a
lowered number of searches fully applies after a restart of the client).
Searches are saved by this web UI from this version on, including searches started from a feed entry; searches for
a file hash aren't saved.

## Searching

A search window opened from a feed entry, "Search for alternates" and the like starts its search by itself. If no
hub is connected, it starts as soon as one is. Hubs limit how often one may search, so the client may have to
queue a search; the window then counts down until it is sent.

On a **phone**, **Search options** next to the Search button shows the file type, sizes, excluded words and hubs.
While they are open they use the whole window. Search, or tap Search options again, to get back to the results.

## Colors and text

- **Colors**: ready-made color sets, and your own colors for nicknames (yours, operators, bots, other, favorite
  and ignored users; also bold or not), chats, shared, queued and downloaded items, and the interface itself.
  The color for favorite users applies to users that are already favorites in the configuration of the client;
  this interface can't add favorite users.
- **Tab highlights**: how the tabs of chats are marked, see below.
- **Text and chat**: text size of the interface and of chats, chat font and timestamp format. List columns
  become wider or narrower with the text size.

These pages, **Tab highlights** and **Emoji** show your unsaved choices in a preview only. The rest of the page
changes when you press **Save changes**. On the Colors page the preview stays in view while you scroll (not in a
low window on a computer); a preview that doesn't fit on a small screen can be scrolled by itself.

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

## Emoji

Under **Settings → View → Emoji**:

- **Show emoji in chats** (on by default). Text codes such as `:)` `;-)` `:D` `:P` `<3` in hub and private chats are
  shown as emoji, and a button next to the message box offers emoji to insert. Switched off, chats show the text as
  it is and there is no button. Only the display changes: messages are sent and stored as written.
- **Emoji set**: the emoji of your device, or an emoticon pack of the client
  ([how to add packs](../README.md#emoticon-packs)). With a pack, its codes and pictures replace the device's.
  If a pack can't be read, the emoji of the device are shown and the page says why.

How codes are recognized:

- A code must stand on its own: after a space or another emoji, and followed by a space, punctuation, another emoji
  or the end. Links, magnets and other highlighted text, status messages and logs are never changed.
- At most 48 emoji are shown per message.
- Copying chat text gives the codes of pack pictures. With the emoji of your device it gives the emoji.

The button writes the text code where there is one, so that others can read it in any client. Other emoji are
written as the character itself. On NMDC hubs such characters get lost unless the hub's character set is UTF-8
(by default it is CP1252); ADC hubs transfer them.

## App icon

**Settings → View → App icon** chooses the icon of the web UI: **AirDC++** (the coloured one, which is used until you
choose another), **AirDC++ dark**, or **Your own picture** after **Upload a picture…**. Check the preview and press
**Save changes**. Your picture is kept while another icon is chosen, until you press **Remove your picture**.

- The icon is shown on the browser tab and with the notifications of the browser, also on the login page of a browser
  that you have used before.
- It is the same on all your devices. Other web users have their own.
- Pictures that the browser can show work, such as PNG, JPG, SVG, GIF, WebP and ICO, up to 10 MB. A square one looks
  best; others get see-through borders. It is stored as a PNG of at most 192 × 192 pixels, and an animated picture
  becomes a still one.

### As an app with its own window

The page describes itself to the browser with a *web app manifest* that names the web UI and the chosen icon, and offers
the icon for the home screen of Apple devices. Browsers use these when you add the web UI as an app, such as a web app
of Firefox on the Windows taskbar or a shortcut on the home screen of a phone.

- Add the app after you have logged in and saved your choice.
- An app keeps the icon that it was made with. To change it, remove the app and add it again. In Firefox, click the
  web app button in the address bar of the app's only window: this moves the page back into Firefox and removes the app.
  Reload the page there, and add it to the taskbar again. This also applies to an app that was made with an earlier
  version of this web UI or with the official one.
- How the browsers use the manifest differs. It was checked with Chromium; for Firefox it follows the published source
  of Firefox.

## Synced and per browser

| Same on all devices of a web user                      | Stored in each browser                                                |
|--------------------------------------------------------|-----------------------------------------------------------------------|
| Home widgets, their order on phones, feeds and notes   | text sizes, chat font, timestamps                                     |
| colors, app icon, tab highlights and emoji             | notifications and the other browser settings                          |
| keyboard shortcuts and thumb buttons                   | places and sizes of the Home widgets                                  |
| "Show the Home tab", "Open the system log …"           | tab order, column widths, pane sizes, whether the transfer pane shows |
|                                                        | the Queued and Shared boxes and the options of the file list filter   |

The [ADL searches](#adl-search) and their two settings belong to the client, so they are the same for all web users.

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

## Filtering a file list

The bar of a file list filters the folder that is shown, like the one of the Windows client: the text, the column to
search (**Any** by default), the match type, the **Queued** and **Shared** boxes and **Options...**. The status line
shows how many of the items are listed, for example `2/7`. Rows that are filtered away are not selected by Ctrl+A.

| Match type    | Shows the items where the column …                                                          |
|---------------|---------------------------------------------------------------------------------------------|
| Partial match | contains every word of the text, in any order                                               |
| RegEx         | matches the regular expression; upper and lower case matter                                 |
| Wildcard      | matches as a whole, with `*` for any text, `?` for one character and `\|` between choices   |
| Exact match   | is the text                                                                                 |
| `=` `>=` `<=` `>` `<` `!=` | compares as a number; for **Exact size**, **Size**, **Date** and **Any**       |

Apart from RegEx, upper and lower case don't matter. With **Any**, one of the columns has to match, also the hidden
**TTH** column.

- An operator can be typed in front of the text, for example `>700 MiB` or `<7d`; the match type follows.
- Sizes take `KiB`, `MiB`, `GiB`, `TiB`, `KB`, `MB`, `GB` and `TB`; without a unit they are bytes.
- Dates are ages: `y` years, `m` months (30 days), `w` weeks, `d` days, `h` hours, `min` minutes and `s` seconds
  (also without a unit). `>30d` means older than 30 days.
- With **Any**, the unit decides whether sizes or dates are compared; a number without a unit matches nothing.
- Unticking **Queued** hides what is queued or has been downloaded, unticking **Shared** hides what you share. Other
  items are always listed. In your own file list the boxes don't apply.

| Option                                       | Default | Does                                                       |
|----------------------------------------------|---------|------------------------------------------------------------|
| Exclude matches                              | off     | lists the items that don't match                           |
| Show above the list                          | on      | off puts the bar below the files                           |
| Reset the string when switching directory    | on      | empties the text in another folder                         |
| Treat partial dupes similar to exact dupes   | off     | the two boxes also hide partial and mixed dupes            |

The boxes and options apply to every file list and are remembered by the browser. The text, column and match type
belong to the window.

## ADL Search

ADL Search, known from the Windows client, matches a list of your own searches against a file list and collects what
it finds in **result folders** at the top of the list, such as `<<<ADLSearch>>>`.

Open the window with the **ADL Search** button of the toolbar, or from the **View** menu (on a phone: menu button →
View).

- **New**, **Properties**, **Remove**, **Move up** and **Move down** edit the searches; they are also in the menu of
  a row, and Insert, Enter and Delete work in the list. The box in front of a search switches it on or off.
- Changes are stored at once. If the searches have been changed from somewhere else in the meantime, nothing is
  overwritten: the new list is shown, and you make your change again.
- **Reload** reads `ADLSearch.xml` from the configuration directory again. The file has the format of the Windows
  client.

A search has these properties:

| Property              | Meaning                                                                                          |
|-----------------------|--------------------------------------------------------------------------------------------------|
| Search string         | every word, separated by spaces, has to be found; upper and lower case don't matter              |
| Regular expression    | the string is a regular expression for any part of the name; case matters unless it starts `(?i)`; a tester is below the box |
| Source type           | **Filename**; **Directory** (the whole folder becomes a result); **Full Path**, written with `\` |
| Destination directory | name of the result folder; `ADLSearch` if left empty                                             |
| File size             | smallest and largest size of matching files; not used for directories                            |
| Download matches      | adds matching files of another user to the queue; does nothing for a directory search            |
| Enabled               | only enabled searches are used                                                                   |

The two boxes above the list:

- **Match ADL when a full file list is opened** (on by default): the full list of another user is matched as soon as
  it arrives.
- **Stop after the first match** (off by default): a file or folder is found by one search only, so the order of the
  searches matters. A search with the destination `discard` has no result folder. With this box ticked and such a
  search placed first, what it matches is left out of all other results.

In a file list:

- **Match ADL**, next to the path (on a phone **ADL**), matches the list at any time, for example after changing the
  searches, and also your own list. If only a part of the list is open, it asks and then downloads the full list.
  **Get full file list** in the menu of a user opens the full list right away.
- **Go to directory** in the menu of a result shows where the file or folder is in the list. **Back** returns.
- Downloading works as elsewhere. A whole result folder is saved under its name without `<<<` and `>>>`.
- While the list is being matched it is read again, which takes a moment for a large list. A full list can't be
  reloaded with the **Reload** button.

Seeing the searches requires the permission to view settings, changing them the permission to edit settings, and
**Match ADL** the permission to download. ADL Search needs `daemon-adl-search.patch`
(see the [main README](../README.md#adl-search)).

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

### Links in text files

Addresses in a viewed text or NFO file are links. The text itself is shown exactly as written, so that drawings
stay in line.

- Addresses that start with `http://`, `https://`, `ftp://` or `www.` open in a new browser tab. So do addresses
  without them when they have a path and a common ending, such as `imdb.com/title/tt0111161/`.
- A hub address (`adc://`, `adcs://`, `dchub://`, `nmdcs://`) connects to the hub.
- A magnet link opens the same menu as one in a chat.
- Mail addresses and other kinds of addresses stay plain text, and so does an address that is split over two lines
  (only its first part becomes a link).

The files are written by other people, so look at an address before you open it.

## Download queue

- Selecting a download shows its **Files** and **Sources** below the list. The **×** in the top right corner of that
  view closes it and deselects the download; select it again to bring the view back. On a phone, choose **Files and
  sources** in the menu of a download and leave with **Back to the queue**.
- **Pause all** pauses every download. **Resume all** gives every download automatic priority again, which also
  replaces priorities that you have set by hand. To set one priority for several downloads, select them (Ctrl+A
  selects all) and use **Priority** in their menu.
- **Rescan for errors** and **Force in share** appear for downloads that failed the content check of an extension.
  The first runs the check again, the second accepts the download without it.
- **Remove user from queue** removes the user as a source from all queued files.

**Browse…** under **Download to** opens a folder browser that starts in the folder chosen last time. Web users who
may not browse the files of the server type the folder instead.

## Users and bots

Double-clicking a user in a user list (or pressing Enter on one) opens the user's file list. For a **bot** it opens a
private chat instead, as bots normally share nothing; **Get file list** stays in its menu. The entry in bold is what a
double click does. On a phone, tapping a user opens this menu. A user counts as a bot when the hub says so.

A transfer to a user who can't be connected to stays in the transfer list, with the reason, as long as something is
queued from that user. **Remove file from queue** or **Remove user from queue** in its menu, or closing the file list,
makes it go away (this needs `daemon-failed-connections.patch`, see the [main README](../README.md#failed-transfers)).

## Own file list

**Refresh in share** (menu of a file or folder, or the button next to the path) rescans a shared folder. New files
appear once the client has hashed them; use **Reload** if the list doesn't show them yet.

## Keyboard shortcuts and thumb buttons

| Action                         | Keys          | Mouse          |
|--------------------------------|---------------|----------------|
| Previous tab                   | Alt+Shift+←   | back button    |
| Next tab                       | Alt+Shift+→   | forward button |
| Last used window               | Alt+Q         |                |
| Close the current window       | Alt+W         |                |
| New search                     | Alt+N         |                |
| Home                           | Alt+M         |                |
| Favorite hubs                  | Alt+A         |                |
| Quick connect                  | Alt+C         |                |
| Download queue                 | Alt+U         |                |
| Transfers                      | Alt+R         |                |
| Show or hide the transfer pane | Alt+P         |                |
| Open own file list             | Alt+L         |                |
| System log                     | Alt+G         |                |
| Settings                       | Alt+O         |                |
| ADL Search                     | none          |                |
| Refresh share                  | none          |                |
| Away mode on or off            | none          |                |

On a Mac, Alt is the Option key. The menus show the keys next to their entries.

Under **Settings → View → Shortcuts** you can switch all keyboard shortcuts, the thumb buttons, or single shortcuts
off, and change them:

- Click the keys of a shortcut and press new ones. Esc cancels, Backspace removes them and Tab moves on.
- Choose the thumb button of a shortcut in its list, or click its keys and then press the button with the pointer on
  that field.
- Keys or a button that another action had are taken from it, and the page says so.
- Keys need Ctrl or Alt, except function keys. Combinations for selecting, copying and pasting can't be used, nor
  can those that browsers keep for themselves, such as Ctrl+W, Ctrl+T and Ctrl+Tab. A browser, the operating system
  or an extension may reserve others too; choose different keys if a shortcut doesn't react.

Shortcuts also work while you type in a field, but not while a dialog is open. A thumb button that has a shortcut no
longer goes back or forward in the history of the browser; one without a shortcut, or switched off, does so as usual.

How the thumb buttons depend on the browser:

- Chrome and other browsers built on it give the buttons to the page, which is all that is needed.
- Firefox on a computer does so from version 162. Earlier versions only go back or forward, so the web UI catches
  that in the history of the page. There, anything that goes back or forward, such as the arrows in the toolbar,
  uses the shortcuts of the thumb buttons, and the page needs one click or key press after it is opened. After the
  page has been reloaded, leaving it with Back (when the button has no shortcut) can take an extra press. Switch the
  thumb buttons off to have none of this.
- Safari on a Mac is reported to ignore these buttons. Use the keys there.

If your mouse software gives the buttons another job, the browser never hears of them and they can't switch tabs.

## Using the mouse and keyboard

- Right-click a row, hub tab or column header for its menu.
- Click, Ctrl+click and Shift+click select rows; the arrow, Home, End, Page Up and Page Down keys move the
  selection; Enter opens; Delete removes (where removing is possible); typing jumps to a name.
- Drag column edges and the borders between panes to resize them.

On a phone the layout changes to one window at a time. The menu button opens the window list and menus,
**⋮** opens the menu of a row and a long press starts selecting several rows.

### Long names

In search results and file lists the name column is as wide as the longest name in the list, so that every name can
be read to the end by scrolling sideways: with the scrollbar, a touchpad, Shift and the mouse wheel, the Left and
Right arrow keys, or on a phone by swiping (size and **⋮** stay at the right edge there). A long name therefore
moves the other columns further to the right.

To choose the width yourself, drag the edge of the name column. To get the full names back, double-click that edge,
or tick **Show full names** in the menu of the column header; unticking it gives the usual width. The browser
remembers the choice.

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
