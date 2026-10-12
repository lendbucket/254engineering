# Production read: the five protocol signatures (2026-10-12)

**A READ, NOT AN APPLY.** Nothing here changes either database. The
counterpart runs the query below on production (`fsaryeciduszuahgjbly`) at the
next check and pastes the result. Written 2026-10-12 overnight, on the
operator's ruling of that night.

## Why

Overnight item 4 replaces "The scope of this service is published here once
the engineer of record signs its protocol." on five service lines with
sentences quoted from each line's signed protocol. The repository cannot see a
signature: each one is a row in `eng_seal_acts` on production, written when
Aman signed in his own session. That row carries `content_sha256`, the hash of
the transcription he read and signed. The quotes may only come from that exact
text, so each recorded hash has to equal the hash of the transcription in the
repository today.

**If all five match, item 4 proceeds on this read. If any differs, that line
keeps its pending sentence and the difference is reported.**

## The query

```sql
select protocol_document,
       protocol_version,
       content_sha256,
       created_at,
       voided_at,
       voided_because
from eng_seal_acts
where kind = 'protocol'
  and protocol_document in ('254-MH-001', '254-SL-001', '254-PL-001', '254-RS-001', '254-DS-001')
order by protocol_document, created_at;
```

## The prediction

**Five rows, one per protocol, every `voided_at` null**, each `protocol_version`
`1.1`, and each `content_sha256` exactly the value below. These are the SHA-256
of each transcription's text as the signing function hashes it
(`transcriptionSha256` in `src/lib/protocol-sign.ts`: the declaration's `text`
lines joined by a newline), computed from main at fb9ff42.

| protocol | version | expected content_sha256 |
| --- | --- | --- |
| 254-MH-001 | 1.1 | `d5fb2893f4d618dbdbf7a9d3d1c0998b1462e2adf72caa8d4ba59fb7b34a55d6` |
| 254-SL-001 | 1.1 | `c19522c86abbba90622aa3c1a41f5194a8f6c97134abb8bf8608fc22576c536d` |
| 254-PL-001 | 1.1 | `c8814496b1dd0b0f228b92447f547f7be4b8bf1553278bef5891817bdb6fb27e` |
| 254-RS-001 | 1.1 | `47e8e9ecb2d5fe07f9b37899cf5ee5494202b6a6f59648bf3ab0d85b9f616508` |
| 254-DS-001 | 1.1 | `c47536b8ab31009027e6f443a03bed1b28b6dbf443b85350b7e7bb817756958b` |

**What each other answer means:**

- **A row missing:** that protocol is not signed on production. Its line keeps
  the pending sentence.
- **A hash that differs:** the transcription changed after he signed, so the
  signature does not cover today's text. The platform already treats that
  signature as void (`signatureStatus`). That line keeps the pending sentence.
- **More than one live row for a protocol:** report it; nothing proceeds on that
  protocol until it is explained.

## Development, for comparison

Development (`ythzaiqeoijlrdibnieo`) holds **no** protocol seal acts, read
2026-10-11 by this session's read-only query. The same query there is
predicted to return zero rows.

## Not covered by this read

Template publishing (overnight item 3) waits on Aman's stated discipline for
each protocol, separately; this read does not touch it.
