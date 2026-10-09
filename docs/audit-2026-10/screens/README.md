# Screenshots

JPEG at quality 80, full page, at 390 and 1280 wide. Each folder is one V10
batch, taken from that batch's build on development with probe accounts (no
real person). File names are `<screen>-<width>.jpg`.

| Folder | Taken from | Screens |
| --- | --- | --- |
| `v10-customer/` | `feat/v10-customer`, before 6127a25, the tree that merged as 654798f | account home, settings, bulk order, orders list, sign in, sign up, forgot password, set password, order start, order status |
| `v10-customer-2/` | `feat/v10-customer-2` at 32cbd4d, merged as e19a3dd | order start and status with the order flow's own header; account home, settings, sign in, sign up, portal sign in and set password with the first phone ground (one white main, since overruled) |
| `v10-technician/` | `feat/v10-technician`, before the proportional figures fix | technician dashboard, jobs, capture screen, messages, tasks, certification; account home, settings and sign in with separate sections; portal sign in and set password. `admin-home-*.jpg` are blank: the page did not settle within 90 seconds (see GAPS.md) |
| `receive-quotes/` | `fix/receive-quotes-protocol` at cb46721, merged inside bce1a41 | a roof order's status page with the four RC-001 sentences; the roof, windstorm and foundation service pages; the coastal insight with the added sentence. No windstorm order exists on development, so no windstorm order page was captured |
| `admin-dashboard-speed/` | `fix/admin-dashboard-speed` after the fix, merged as b190559 | the administrator's dashboard, which before the fix never settled and timed out every screenshot run |
| `v10-partner/` | `feat/v10-partner` after its changes | partner home, materials, referrals, statements, agreement (all on the phone ground with separate sections), partner sign in and set password (title and form as two sections) |
| `v10-admin-accounts/` | `feat/v10-admin-accounts` after its conversions | accounts (long: development holds many probe accounts, paged at 25), billing, clients, a partner's record, reports, suppressions, deletion requests, the administrator's dashboard with the table header fixed |
| `v10-admin-ops/` | `feat/v10-admin-ops` after its box conversions | technicians, job queue, new job (intake), people, onboarding, roles, platform status, files, charge log; the administrator's and the technician's dashboards (the latter with "Needs you" and "Your pay" as separate phone sections); the roof order start page reading "Read what roof certifications cover" |

The spaced out hyphens and digits in "F-29811" and email addresses in these
captures are the tabular figures setting, fixed on `feat/v10-technician` after
these were taken.
