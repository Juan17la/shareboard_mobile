# Troubleshooting

## A board takes long to open the first time

The server runs on a free plan that **sleeps after a period without visitors**.
The first request wakes it up, which can take up to a minute. The loading
screen says so after seven seconds. Wait, and the board opens; after that it is
fast.

## "Offline" or "Reconnecting…"

The connection to the server dropped. Shareboard retries on its own a few
times, then shows a **Retry** button. While offline, a live board is
**read-only**, so nothing you draw is lost without you knowing. Your
*Only on this device* board keeps working without a connection.

## "Read only" / I have no tools

The board's creator chose who can edit, and you are not on the list. Ask them
to open **Permissions** and choose *Everyone*, or add you under *Selected*.

## "Incorrect PIN"

The board is private. Ask the creator for its 4-digit PIN (they can see it in
**Permissions**). After 5 wrong attempts in a minute you have to wait a minute.

## "That nickname is in use here"

Someone on the board already uses that name (names are compared ignoring
upper and lower case). Choose another one.

## "There is no board with that code"

Check the code: it is six characters, letters and digits. Shareboard never uses
`0`, `O`, `1`, `I`, `L` or `U`, so if you read one of those, it is probably a
`Q`, `D`, `2`, `J`, `K` or `V`. The board may also have been deleted by its
creator.

## "Too many boards created from this address"

Each network address can create 10 boards per hour. Wait a little, or open an
existing board.

## An image is refused as too big

Pictures are shrunk before they go on the board, but a very detailed one may
still not fit. Try a smaller or simpler image, or crop it first.

## Android will not install the APK

- Allow your browser or file manager to **install unknown apps** when Android
  asks.
- If Android says the package conflicts with an existing one, a copy signed
  differently is installed (for example a development build). Uninstall it
  first. This removes the offline board on that phone; export it before if you
  want to keep it.

## The app does not offer the new version

The app checks GitHub releases when it opens. It needs internet access at that
moment, and only release builds check (not development builds). You can always
download the APK from the
[releases page](https://github.com/Juan17la/shareboard_mobile/releases).

## Copy image does not work in the browser

Some browsers only allow copying to the clipboard from a secure (`https`) page
and after you allow it. Use **Download** instead.

## Something else

Open an issue on the repository of the part that misbehaves
([web](https://github.com/Juan17la/shareboard_web/issues),
[Android app](https://github.com/Juan17la/shareboard_mobile/issues),
[server](https://github.com/Juan17la/shareboard_server/issues)), with what you
did, what you expected, and the app version (shown in the release you
installed).
