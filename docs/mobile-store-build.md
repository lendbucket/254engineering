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

`appId` in `mobile/capacitor.config.json`. Today it is **`com.example.field254`**,
a placeholder until Robert gives Craftline's domain. Google Play refuses any
`com.example` ID, so the placeholder cannot be published by accident.

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

1. Sign in at console.firebase.google.com with the Google account that will own
   the firm's Firebase project (Craftline's or the firm's: question 2 on issue #1).
2. **Add project**, named "254 Field". Google Analytics is not needed; leave it
   off.
3. In the project, **Add app**, then **Android**. For the package name, enter
   exactly the `appId` in `mobile/capacitor.config.json`, today
   `com.example.field254`. The nickname can be "254 Field Android". Skip the
   SHA-1 for now.
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

If the app ID changes to Craftline's domain later, steps 3 and 4 are repeated
for the new package name. Step 7 does not change.

## iPhone

`mobile/ios` is set up: the Xcode project with Swift Package Manager, so there
is no CocoaPods, and the three plugins are listed in `CapApp-SPM/Package.swift`.

### What needs a Mac (with Xcode)

1. `npm install` and `npm run sync:ios` in `mobile/`, which applies the app ID.
2. Open `mobile/ios/App/App.xcodeproj` in Xcode.
3. **Signing & Capabilities:** choose the Apple team, and add **Push
   Notifications** and **Background Modes**, with "Remote notifications" ticked.
4. **Info:** the camera usage sentence, `NSCameraUsageDescription`: "The camera
   takes the photographs the job's checklist asks for. They stay in the app and
   upload to the firm." The wording is Robert's to approve.
5. Build to a real iPhone, or to TestFlight.

### What needs the Apple account (Craftline's Apple Developer Program)

1. Register the app ID, the bundle identifier, with the Push Notifications
   capability.
2. Create an **APNs key** (`.p8`). Set in Vercel, Production only:
   **APNS_KEY_P8** (the file's contents, a secret), **APNS_KEY_ID**,
   **APNS_TEAM_ID**, and **APNS_TOPIC** (the bundle identifier).
3. Create the app record in App Store Connect, then TestFlight and review.

Nothing else is left for iOS: the project, the plugins, the push sender and the
app ID handling are all done.

## Store listing materials

`docs/store-listing.md` has the name, the descriptions, the keywords and the
privacy answers, ready to paste. Icons come from the firm's logo
(`mobile/resources/`), and screenshots from the debug build.

## Open, waiting on decisions

- The app ID's domain (Craftline's).
- Secure storage: the device session it needs (question 1).
- Who owns the Firebase project (question 2).
