# The store listing for 254 Field (T8)

Robert's T8 order of 2026-11-08, item 4: the store listing materials, ready to
paste, following the site's copy rules and the regulatory gate.

**What the words may and may not say.** The app is a tool for the technicians
the firm assigns work to. It describes what the app does, in the present tense,
and makes no claim about engineering services, sealing, turnaround or
results. "254 Engineering LLC" is the firm's registered name, and no other name
is used for it. Craftline Brands IP LLC is the publisher the stores show. No
review or rating is mentioned, and no figure.

## Name

- **App name (both stores):** 254 Field
- **Apple subtitle (30 characters):** Jobs and photos for the field
- **Google short description (80 characters):** The field app for technicians assigned work by 254 Engineering LLC.

## Long description (both stores)

> 254 Field is the app technicians use when they work jobs assigned by
> 254 Engineering LLC. It is for technicians with an account from the firm;
> there is nothing to sign up for in the app.
>
> See the jobs offered to you and accept or decline them. Open a job and work
> its checklist: take the photographs and readings it asks for, and record
> anything that could not be done, with the reason. Photographs stay in the app
> and upload to the firm. They are never saved to the phone's photo library.
>
> No signal at the property? Open My jobs once before you leave, and the day's
> jobs open on the phone. Photographs taken with no signal are kept and upload,
> in the order they were taken, when the signal returns.
>
> Arrived and Leaving record your visit on the firm's clock. When the engineer
> sends a job back, the note is at the top of the job and you reply from the
> phone. Offer alerts tell you when a job is offered: the county and the
> service, never the address or the rate.
>
> Sign in with the account and second factor the firm set up for you. Questions
> about the app: support@254engineering.com.

## Keywords (Apple, 100 characters)

`field,technician,jobs,checklist,photos,offline,inspection,property,visit,capture`

## Category

- **Apple:** Business
- **Google:** Business

## Privacy answers

Both stores ask the same questions in different forms. The answers below are
what the app does today, read from the code (`src/lib/offline-queue.ts`,
`src/lib/native-shell.ts`, `src/lib/ops-push.ts`, the capture route).

| Data | Collected | Linked to the person | Used for | Shared with third parties | Tracking |
| --- | --- | --- | --- | --- | --- |
| **Photos** (taken in the app for a job) | Yes | Yes, the technician who took them | App functionality: the job's evidence | No. Stored by the firm's providers (database and file storage), which the stores count as service providers, not sharing. | No |
| **Precise location** (attached to a photograph when the phone gives it) | Yes, optional: a photograph is taken whether or not the phone allows it | Yes | App functionality: where the photograph was taken | No | No |
| **Name, email address, phone number** (the technician's account) | Yes | Yes | App functionality: the account | No | No |
| **User ID** (the account's id) | Yes | Yes | App functionality | No | No |
| **Device ID** (the push token, if offer alerts are on) | Yes | Yes | App functionality: offer alerts | Sent to Apple or Google to deliver the alert. That is the delivery itself, not sharing. | No |

- **Not collected:** contacts, browsing history, search history, health,
  financial information, advertising data, crash or usage analytics.
- **Data is encrypted in transit:** yes (https only; the shell refuses
  cleartext).
- **A person can ask for their data to be deleted:** yes, by writing to
  support@254engineering.com.
- **Google's "data safety" form:** the same rows. Collection is required for
  photos and the account, and optional for location and the device ID.

## Privacy policy page and support address

- **Privacy policy URL:** https://254engineering.com/privacy
- **Support URL:** https://254engineering.com/contact
- **Support email:** support@254engineering.com

**The published privacy page does not yet describe the app**: photographs taken
on a job, their location, and the push token. Both stores check the policy
against the answers above. A section is drafted below for Robert to approve.
Robert's answer 3 of 2026-11-08 (6725977818): the chat counterpart reads it
first and sends it to him, and it goes on `/privacy` as its own full-lane
change only after his word. Nothing has been changed on the live page.

> **The field app.** Technicians who work jobs for the firm use the 254 Field
> app. In it they take photographs of the property they are assigned to, and
> the app attaches the phone's location to a photograph when the phone allows
> it. Photographs and locations are kept by the firm with the job's record and
> are not saved to the phone's photo library. If a technician turns on offer
> alerts, the app keeps a token from Apple or Google so the firm can tell that
> phone when a job is offered. The alert names the county and the service only.
> A technician can turn alerts off at any time in the app, and signing out
> turns them off on that phone.

## Icons

From the firm's own mark, by `mobile/scripts/make-icons.mjs`, which calls the
same `master()` that makes the site's favicons: the numerals and the gold rule,
white on the footer navy. Android has the legacy and round icons at five
densities and the adaptive foreground, on a navy background. iOS has the 1024
icon.

- **Google Play also asks for a 512 icon:** `public/icons/icon-512.png`.
- **Google Play's feature graphic** (1024 by 500): to be made from the same mark
  when the listing is created. It is not needed for testing.

## Screenshots

From the debug build: `docs/store-screens/`, taken on an Android emulator
against a development server, with a probe technician on the development
database and no real job or person. The stores' sizes:

- **Google Play:** at least two phone screenshots, 16:9 or 9:16.
- **Apple:** 6.9 inch display screenshots, taken on a Mac once the iOS build
  exists. Apple's sizes need its simulator.
