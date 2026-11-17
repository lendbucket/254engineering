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
