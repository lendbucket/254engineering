# Store screenshots, route B

Taken 2026-11-16 at 23:56 Central, on Robert's answer 16 (issue #1): the field
app's own screens, which are the portal's technician screens, captured in a
browser against a local development server built from main `c314b71`. A probe
technician on the development database (the audit-probe.invalid domain) signed
in with its own session. Every probe on that domain was removed afterwards and
the removal read back: none left. No real job, person, address or figure appears.

## Which set to upload

| Folder | Size in pixels | Ratio | Use |
| --- | --- | --- | --- |
| `412x732/` | 1082 by 1922 | 9:16 | **Google Play.** Within Play's rule that the long side is at most twice the short side. |
| `412x915/` | 1082 by 2402 | about 1:2.22 | As approved in answer 16. **Play refuses this ratio**; kept for the record and for any listing that takes a taller phone. |

Apple's 6.9 inch sizes need its simulator on a Mac and are not here.

## The eight screens, in each folder

| File | Screen | What it shows |
| --- | --- | --- |
| `home.png` | Dashboard | The technician's counts: offers, jobs held, deadlines, tasks. All zero for a new technician. |
| `jobs.png` | My jobs | "No offers right now", with how a job reaches a technician. |
| `certification.png` | Certification | The technician's certification by service line. |
| `pay.png` | Your pay | The technician's own pay only. Empty for a new technician. |
| `tasks.png` | Tasks | Open tasks. |
| `procedures.png` | Procedures | The field procedures. |
| `messages.png` | Messages | The technician's messages. |
| `files.png` | Files | The technician's files. |

**They are honest and sparse.** A new technician has no work, and none was
invented, because assigning existing demonstration jobs to the probe would have
changed rows the run did not make. Screens with a job in them would need a probe
job made and removed by the same run, which no fixture does today.

## `with-a-job/412x732/`: the same screens with work on them

Taken 2026-11-17 at about 22:15 Central, on Robert's order of that morning,
from main `1034853` against development. **This is the set to upload to Google
Play**, 1082 by 1922, 9:16.

The probe-job fixture made, for one probe technician, two DEMONSTRATION files
(`is_demo`, numbered `254-DEMO-STORE...`) on an existing demonstration client:
one offered and one accepted and dispatched. They were written directly, so no
notification went anywhere, and the run removed both files by their mark and
read the removal back (removed 2, none left), then every probe (none left).

| File | What it shows |
| --- | --- |
| `jobs.png` | My jobs, with an offer card: **$85.00**, 100 Demonstration Lane, Nueces County, Roof Inspections and Certifications, Accept this job and Decline |
| `job-offer.png` | The offered job's own page, with its accept controls |
| `job-accepted.png` | The accepted job: Dispatched, 0 of 51 required captured, Directions, Messages on this file, Arrived, I could not get in |
| `home.png` | The dashboard, with the offer and the held job counted |
| `pay.png`, `certification.png`, `tasks.png`, `procedures.png` | As in the first set |

**What is real and what is not.** The $85 is the firm's own technician visit
rate, read from `TECHNICIAN_CALL_CENTS` in `src/config/cost-inputs.ts` and not
typed, because a store screenshot can read as advertised pay. The address says
"Demonstration Lane", so no real property appears. **The accepted job's file
number reads `254-DEMO-STORE1335912` on screen**, which says plainly that it is a
demonstration; whether a listing should show that is Robert's call.
