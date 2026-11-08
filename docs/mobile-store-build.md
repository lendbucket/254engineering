# The field app in the Apple and Google stores (T8)

Robert's T8, in scope since his word of 2026-11-07 at 21:28 and 21:30 Central
(issue #1, 6716719712 and its correction 6716738509), and the counterpart's
answer 8 on his behalf (6717223376): **Capacitor, with the three native pieces,
built now on its own branch toward the Craftline Brands accounts, boarded only
once T2 to T7 are merged.** The store apps publish under Craftline Brands' D-U-N-S
number and its Apple developer account, once they exist.

**What is on this branch, and what is not.** This branch carries the shell's
configuration (`mobile/capacitor.config.json`), its package manifest
(`mobile/package.json`) and this plan. **Nothing is installed, built, signed or
tested.** Installing Capacitor into the main checkout would change the
`node_modules` every worktree on this machine shares, so it is installed only in
`mobile/`, on the machine that does the first store build. Every version below is
to be confirmed at that install, not read tonight.

## What it is

A Capacitor shell whose web view opens the portal's technician screens on
production (`server.url`, `https://254engineering.com/portal/jobs`), limited to
the firm's own domain. The screens stay the portal's screens. There is one code
base, and a fix to a screen reaches the app with no store release.

## The three native pieces, and why each is there

Apple's App Review Guideline 4.2 refuses an app that is only a website in a
frame. Each piece below is also something the technician needs. That is the
honest reason to build it, and it is what keeps the app clear of 4.2.

1. **The camera, into the app's own storage.** `@capacitor/camera` with the
   result kept in the app's sandbox, never written to the shared photo library.
   This is mobile plan section 6: a customer's property photographs do not belong
   in a technician's personal camera roll. The capture code calls the native
   camera when it runs inside the shell, and the browser's file input otherwise.
   The hash at capture (T2) is taken the same way either way.
2. **Push through Apple's and Google's own services.** `@capacitor/push-notifications`.
   Inside the shell, web push (T9) is replaced by APNs and FCM. The subscription
   table from 0124 holds the native token beside its kind, and the lock screen's
   wording is unchanged: county and service, from the firm's server.
3. **The session in the phone's secure keystore.** Mobile plan section 4: a native
   screen needs a token it can store, and it is stored only in the Keychain or
   Keystore. **This needs a plugin choice**, because Capacitor's own Preferences
   plugin is not a keystore. It also needs the per-device session record the
   plan describes, revocable from `/portal/people`. Both are open, below.

## What Robert provides, for Craftline Brands IP LLC

The fees and waits are as Apple and Google publish them, to be confirmed at
enrolment rather than taken from here.

- **D-U-N-S number.** Apple requires one for an organisation account. It is free
  through Apple's lookup and can take some business days to issue.
- **Apple Developer Program, as an organisation.** A yearly fee and Apple's check
  of the entity.
- **Google Play Console, as an organisation.** A one-time fee and Google's
  identity check.
- **The app identifier.** `mobile/capacitor.config.json` says
  `com.craftlinebrands.field254` as a placeholder. A reverse domain the publisher
  controls is the convention, so it waits on which domain Craftline holds.
- **For each listing:** a privacy policy page, a support address, screenshots,
  and the store's data questions (photographs, location, account details).

## The steps, once the accounts exist

1. In `mobile/`, `npm install`, then `npx cap add ios` and `npx cap add android`.
2. Wire the three native pieces into the capture, push and session code. Each is
   behind a check that the page is running inside the shell, so the browser app
   is unchanged.
3. Icons and splash from the field manifest's own rasters (`scripts/brand-rasters.mjs`).
4. A signed build per store; TestFlight and a Play internal track first, on
   Robert's own phone.
5. Store review. Plan for one Apple 4.2 round even with the native pieces in.

## Open, waiting on decisions

- **The publisher's identifier domain**, for `appId` (above).
- **The secure storage plugin** for the session token, and the per-device
  session record with revocation (mobile plan section 4). Neither is built.
- **The native push token in 0124's table**, which today holds web push
  endpoints only. That is a migration when T8's push piece is built, through the
  normal sitting.
