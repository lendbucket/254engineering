# Fonts

Two files, loaded by `src/app/layout.tsx` through `next/font/local`.

| File | Face | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `inter-latin.woff2` | Inter, upright, variable, latin subset | 48,432 | `c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4` |
| `inter-latin-italic.woff2` | Inter, italic, variable, latin subset | 51,636 | `7ddd9658a57d7c5811b4f6aa43625433d72c05ac83c46a231ef3dfd88813c8a1` |

**Where they came from.** These are the latin files that `next/font/google` downloaded and self-hosted for this repository's own Inter declaration (`subsets: ["latin"]`, weights 400 to 700, normal and italic). They were copied from a build of main at `0e5ccef` on 2026-10-25. The build's CSS pointed every weight from 400 to 700 of each style at a single variable file, so these two files cover what the site served before.

**Why they are here.** Robert ruled on 2026-10-25 that no board may depend on Google's servers. Board 40173467851's mobile-audit server never started because the Google font fetch failed on the runner.

**Licence.** Inter is by The Inter Project Authors (https://github.com/rsms/inter) and is licensed under the SIL Open Font License, version 1.1. The licence text is at https://openfontlicense.org and in the Inter repository's LICENSE.txt. **Open item:** commit that licence text beside these files. It has not been added from memory, so that its wording is the published text.
