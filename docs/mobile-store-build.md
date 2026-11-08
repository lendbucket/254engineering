# The field app in the Apple and Google stores (T8)

Robert's T8, in scope since his word of 2026-11-07 (issue #1, 6716719712 and
6716738509, and answer 8 of 6717223376), and his order of 2026-11-08: **start
the build now; the D-U-N-S number and the store accounts are needed only to
publish.** The store apps publish under Craftline Brands IP LLC's D-U-N-S number
and developer accounts.

## What it is

A Capacitor 8.6 shell (`mobile/`) whose web view opens the portal's technician
screens on production (`server.url`, `https://254engineering.com/portal/jobs`),
held to the firm's own domain, with no cleartext. **The app is the portal's
screens.** There is no second copy of any screen or rule in native code: the
screens, their guards (a technician sees only his own jobs, and no firm money
reaches a technician screen) and every rule stay where they are, and a fix to a
screen reaches the app with no store release.

Capacitor is installed in `mobile/node_modules` only, never in the main
checkout's `node_modules` that every worktree on this machine shares.

## The app ID: one value, one file

`appId` in `mobile/capacitor.config.json`. It is **`com.craftlinebrands.field`**,
from Craftline's domain craftlinebrands.com (Robert, 2026-11-08, 6725968716).
It replaced the placeholder `com.example.field254`, so the debug app sent on
2026-11-08 carries the old ID and installs beside the next one as a different
app. **Once the first store listing exists this ID cannot change.**

The Android code package (`namespace` in `build.gradle`, and the folder
`MainActivity.java` sits in) is `com.craftlinebrands.field254`. That is the
Java package of the code, not the ID the stores and Firebase see, and it does
not need to match.

- **Android** reads it at build time (`mobile/android/app/build.gradle`).
- **iOS** gets it from `mobile/scripts/apply-app-id.mjs`, which `npm run sync`
  runs first. That script refuses unless it finds the bundle identifier exactly
  twice, for Debug and Release.

**Changing it is one edit in that file, then `npm run sync` in `mobile/`.** A
phone with the old ID installed treats the new one as a different app.

## The three native pieces

Each is reached from the portal's own code through `src/lib/native-shell.ts`,
which reads Capacitor's bridge off the window. In a browser, every function there
answers "not in the shell", and the screen behaves as it always has.

1. **The camera** (`@capacitor/camera`).
   - Inside the app, the capture screen's photograph button takes the picture
     with `saveToGallery: false`, so the photograph stays in the app's own
     storage and never reaches the phone's shared photo library.
   - It then goes into the same `capture()` as a browser photograph: the hash
     is taken at capture (T2), the queue holds it, and the server hashes the
     stored bytes and refuses a mismatch.
2. **Push** (`@capacitor/push-notifications`): Firebase on Android, Apple's
   service on iPhone.
   - My jobs' "Offer alerts on this phone" asks the phone for its token and
     records it through the same `push_subscribe` and the same table as web
     push. 0124 gained a `channel` column (`web`, `fcm` or `apns`) for this,
     before it reached any database.
   - The server sends with `src/lib/native-push.ts` (Firebase's HTTP v1 API;
     Apple's APNs over HTTP/2).
   - The text is `offerPushText`'s: county and service, never an address or a
     price.
   - **The one difference from web push:** a native push carries its own text
     through Apple's or Google's service, where a web push carries none.
3. **Secure storage** (`@aparajita/capacitor-secure-storage`, installed).
   - **Not wired, on purpose.** Putting the sign-in token in the keystore
     needs a server-side device session: the portal's session is an HttpOnly
     cookie, which the app's own code cannot read, so a token the app could
     hold would have to be issued, revoked and audited by the server (mobile
     plan section 4).
   - That is a change to authentication, and it is Robert's to rule. It is
     question 1 on issue #1.
   - Until then, the app keeps the portal's own cookie in the web view, exactly
     as the browser does: twelve hours, the second factor, and the role re-read
     on every call.

## Android (builds on this PC)

`mobile/android`: compileSdk and targetSdk 36, minSdk 24, JDK 21. The debug
build is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`, built with
`gradlew assembleDebug` under the machine lock.

### Firebase: Robert's steps, in order

1. Sign in at console.firebase.google.com with **254 Engineering's Google
   account**. The project belongs to 254 Engineering, with Robert as owner
   (Robert, 2026-11-08, 6725968716). If another person is ever added, add them
   under **Project settings, Users and permissions**, never as owner.
2. **Add project**, named "254 Field". Google Analytics is not needed; leave it
   off.
3. In the project, **Add app**, then **Android**. For the package name, enter
   exactly the `appId` in `mobile/capacitor.config.json`:
   `com.craftlinebrands.field`. The nickname can be "254 Field Android". Skip
   the SHA-1 for now.
4. Download **google-services.json** and send it to me. I put it at
   `mobile/android/app/google-services.json`. It is ignored by git: it names the
   project rather than holding a secret, but it stays out of the repository
   anyway.
5. In **Project settings**, open **Cloud Messaging** and confirm "Firebase Cloud
   Messaging API (V1)" is enabled.
6. In **Project settings**, open **Service accounts**, then **Generate new
   private key**. A JSON file downloads. **This one is a secret.**
7. In Vercel, Production only, set **FIREBASE_SERVICE_ACCOUNT_JSON** to the whole
   contents of that file. Then delete the file from your computer.
8. Tell me when 4 and 7 are done. I rebuild the debug app with Firebase in it,
   and you turn on "Offer alerts on this phone" in My jobs.

For the iPhone, the same Firebase project is not needed: Apple's push service
is reached directly with the APNs key (below), so Firebase stays Android only.

## iPhone

`mobile/ios` is set up: the Xcode project with Swift Package Manager, so there
is no CocoaPods, and the three plugins are listed in `CapApp-SPM/Package.swift`.

### What the project already carries, so no Mac is needed

Robert, 2026-11-08 (6725968716): the iPhone builds on Codemagic, because there
is no Mac here. What a person would otherwise do in Xcode is written into the
project:

- **Push:** `App/App.entitlements` with `aps-environment`, referenced by both
  build configurations (`CODE_SIGN_ENTITLEMENTS`), and the two push methods in
  `AppDelegate.swift` that pass Apple's token to the plugin.
- **Background Modes:** `remote-notification` in `Info.plist`.
- **The camera sentence** in `Info.plist`, `NSCameraUsageDescription`: "The
  camera takes the photographs the job's checklist asks for. They stay in the
  app and upload to the firm." The wording is Robert's to approve.
- **The app ID:** `com.craftlinebrands.field`, applied by `npm run sync:ios`.

**None of it has been compiled.** Codemagic's first run is the first compile
of the iOS project, so its log is read before anything here is called done.

### iPhone builds on Codemagic

**The cost, as Codemagic publishes it, read 2026-11-08 at codemagic.io/pricing:**

| Plan | Price | What it gives |
| --- | --- | --- |
| Free (individuals) | $0 a month | 500 build minutes a month on a Mac mini M2, one build at a time, one team member |
| Pay as you go | $0 base, billed per minute | Mac mini M2 $0.095 a minute, Mac mini M4 $0.114 a minute; extra concurrency $49 a month each |
| Fixed price | from $3,990 a year | Unlimited minutes, three builds at once |

**Recommendation: the free individual plan.** It needs a single user, which is
Robert, and the workflow is set to `mac_mini_m2`. A Capacitor iPhone build is
typically 10 to 20 minutes, so 500 minutes covers roughly 25 to 50 builds a
month. That is an estimate, not a measurement; the first run's duration
replaces it. If a month ever runs past 500, pay as you go at $0.095 a minute is
about $1 to $2 a build.

**What Codemagic needs from Robert, and when:**

1. **Now, if he likes, or when the Apple account exists:**
   - a Codemagic account, signed up with GitHub as Robert;
   - the `lendbucket/254engineering` repository added as an app.
   - Nothing builds yet.
2. **When Craftline's Apple Developer account is active** (after the D-U-N-S):
   - **An App Store Connect API key.** Create it in App Store Connect, under Users and Access, Integrations, App Store Connect API, with the **App Manager** role. Download the `.p8` once, and note the Issuer ID and the Key ID.
   - Add all three in Codemagic, under Team integrations, Developer Portal, named exactly `254 Field App Store Connect`, the name in `codemagic.yaml`.
   - **No certificates are made by hand.** With that key, Codemagic creates the distribution certificate and the provisioning profile for `com.craftlinebrands.field` itself.
3. **Before the first build:**
   - register the bundle ID `com.craftlinebrands.field` in the Apple Developer portal with Push Notifications;
   - create the app record in App Store Connect under that bundle ID.
4. **The first build:** Robert starts the `ios-testflight` workflow by hand in Codemagic. No push to GitHub starts it. It builds, signs, and uploads to TestFlight. Submitting for App Store review stays a separate step he takes in App Store Connect.

**Push on iPhone**, separate from Codemagic, from the same Apple account:
- Create an **APNs key** (`.p8`) under Certificates, Identifiers and Profiles, Keys, with Apple Push Notifications service.
- Set in Vercel, Production only:
  - **APNS_KEY_P8** (the file's contents, a secret);
  - **APNS_KEY_ID**;
  - **APNS_TEAM_ID**;
  - **APNS_TOPIC** (the bundle ID, `com.craftlinebrands.field`).
- The App Store Connect API key and the APNs key are two different keys.

## Store listing materials

`docs/store-listing.md` has the name, the descriptions, the keywords and the
privacy answers, ready to paste. Icons come from the firm's logo
(`mobile/resources/`), and screenshots from the debug build.

## Open, waiting on decisions

Robert answered all five T8 questions on 2026-11-08 (6725968716, 6725977818):

- **The app ID:** `com.craftlinebrands.field`. Done.
- **Firebase:** 254 Engineering's Google account, Robert as owner. The steps
  above say so.
- **The iPhone:** Codemagic, planned above.
- **Secure storage:** the debug build keeps the web view's cookie. The device
  session (a keystore token, revoked on sign out and when the session epoch
  moves) is its own full-lane item, with its migration and proof, **before the
  first store submission.** It is in BACKLOG.md.
- **The privacy section:** drafted in `docs/store-listing.md`. It goes on
  `/privacy` as its own full-lane change only after Robert's word.
- **Signing out on a shared phone:** turns off that phone's offer alerts first,
  then ends the session. Built.
