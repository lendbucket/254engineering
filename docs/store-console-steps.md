# The store app: what Robert does in each console

Autopilot item 6 of 2026-11-14: app store preparation that needs no sign-in,
and a list of what only Robert can do. Everything that can be prepared without
an account is in the repository; this file is the rest, in the order it can be
done. The full account of the build is `docs/mobile-store-build.md`, and the
listing copy is `docs/store-listing.md`.

**What is ready in the repository**

| Item | Where |
| --- | --- |
| App ID, both stores | `com.craftlinebrands.field` (`mobile/capacitor.config.json`, `codemagic.yaml`) |
| App name, subtitle, short and long descriptions, keywords, category | `docs/store-listing.md` |
| Privacy answers for Apple's labels and Google's data safety form | `docs/store-listing.md`, with the sign-in session row added 2026-11-14 |
| Icons: Android at five densities and adaptive, iOS 1024, Play 512 | `mobile/android/.../mipmap-*`, `AppIcon-512@2x.png`, `public/icons/icon-512.png` |
| Play feature graphic, 1024 by 500 | `mobile/resources/play-feature-graphic.png` |
| Privacy policy and support pages | `/privacy` (the app section since 2026-11-08), `/contact`, support@254engineering.com |
| The device session in the keystore | 0125, on production since 2026-11-12 |
| The iPhone build workflow | `codemagic.yaml`, `ios-testflight`, started by hand only |

**What is not ready, and why**

- **Screenshots:** not taken. They need the Android debug build on an emulator
  (this PC) and, for Apple's 6.9 inch sizes, a simulator on Codemagic's Mac.
- **Location on a photograph in the store app:** probably never attached
  (question 27 on issue #1). Read from the platform files on 2026-11-14 and not
  yet confirmed on a phone: capture reads the web view's location, and neither
  platform declared what a web view needs to be given it. On `store/prep`, on
  the question's recommendation: the two Android location permissions, and an
  iOS location sentence drafted for Robert's approval, as the camera sentence
  was. Neither platform has been compiled with them.
- **Export compliance:** `ITSAppUsesNonExemptEncryption` is set to false on
  `store/prep` (the app uses only https), so App Store Connect stops asking on
  every upload. The declaration is Robert's (question 27).
- **The privacy page and the sign-in session:** question 26.

## Apple, in order

1. **D-U-N-S number for Craftline Brands IP LLC**, then enrol Craftline in the
   Apple Developer Program as an organisation. Everything below waits on this.
2. **Certificates, Identifiers and Profiles:** register the bundle ID
   `com.craftlinebrands.field` with Push Notifications.
3. **Keys:** create an APNs key (`.p8`) with Apple Push Notifications service.
   In Vercel, Production only, set `APNS_KEY_P8`, `APNS_KEY_ID`,
   `APNS_TEAM_ID` and `APNS_TOPIC` (`com.craftlinebrands.field`).
4. **App Store Connect:** create the app record under that bundle ID, named
   254 Field, publisher Craftline Brands IP LLC.
5. **App Store Connect API key** (Users and Access, Integrations), role App
   Manager; add the `.p8`, Issuer ID and Key ID to Codemagic as
   `254 Field App Store Connect`, the name `codemagic.yaml` uses.
6. **Codemagic:** add `lendbucket/254engineering` as its own app in the
   existing account, then start `ios-testflight` by hand. Its log is read
   before anything is called done; it is the first compile of the iOS project.
7. **App Privacy:** enter the answers in `docs/store-listing.md`.
8. **App Review information:** the app is sign-in only, and Apple's review
   asks for a way in. Which account a reviewer may use is Robert's decision
   (question 28): it would be a real technician account on production.
9. **Submit for review** from App Store Connect, as its own deliberate step.

## Google, in order

1. **Play Console developer account** for Craftline as an organisation (it
   asks for a D-U-N-S number too).
2. **Firebase** under 254 Engineering's Google account: the eight steps in
   `docs/mobile-store-build.md`, ending with `google-services.json` sent to the
   session and `FIREBASE_SERVICE_ACCOUNT_JSON` set in Vercel, Production only.
3. **Create the app** in Play Console, package `com.craftlinebrands.field`,
   with Play App Signing.
4. **Store listing:** the text and graphics listed above; screenshots when
   they exist.
5. **Data safety** from `docs/store-listing.md`; **content rating**
   questionnaire; **target audience** (adults, a work tool); **app access**:
   the same reviewer account question as Apple's (question 28).
6. **Internal testing track** first, with the release bundle the session
   builds on this PC once an upload key exists. The upload key is created on
   this PC and kept out of the repository; where Robert keeps its backup is
   his decision.
