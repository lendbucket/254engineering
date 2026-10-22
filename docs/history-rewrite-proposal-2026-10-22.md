# What removing the signed protocols from history would take

Written 2026-10-22 on Robert's ruling 2 of that day: "Do not rewrite history
yet. Write up what a rewrite would take ... and hold it for my decision."
Nothing here has been done. **It needs his word, and it needs a force push,
which the standing rules forbid until he gives it.**

## What is exposed, and since when

The repository `lendbucket/254engineering` is public.

| File | What it carries | First commit | On the remote |
| --- | --- | --- | --- |
| `docs/254-RC-001-roof-certification-protocol-v1.0.pdf` | Aman Dhakal's handwritten signature (an embedded JPEG image, page 11, the same image in both versions as `rc-001.ts` records), dated 09/14/2026; PDF author "amand" | `efbbcda`, 2026-09-16 | 126 of 135 branches |
| `docs/254-RC-001-roof-certification-protocol-v1.1.pdf` | His signature again, dated 09/20/2026; author "amand" | `f0bcf0c`, 2026-09-20 | the same branches, from that date |
| `docs/protocols/incoming/v1.1/254_Letter_Templates.docx` | "Texas P.E. No. 143295" beside his name, six times; last modified by "Aman Dhakal" | `524fa76`, 2026-10-06 | 119 branches |

Two older letter-template files carry the same licence line, and **neither was
ever pushed**: `919fa5c` and `fc37202` exist only on the local branch
`templates/drafts-2026-09-28`, and `d0ea531` only on `docs/aman-2026-10-05`.
They need removing from this PC's history, not GitHub's.

The licence number is on the public TBPELS roster. The signature is not, and a
signature cannot be rotated, which is what makes it the item that matters.

## What a rewrite would do

`git filter-repo --invert-paths` on a fresh mirror clone, naming the three
paths (and, locally, the two never-pushed ones). Every commit from `efbbcda`
onward is rewritten, because each one's hash depends on its parent's.

- **About 955 commits get new hashes**, including 857 on main since `efbbcda`.
- **Every remote branch that contains them, 126 of 135, is force pushed**, main
  among them. The one tag, `archive/design-bold`, predates `efbbcda` and is
  untouched.
- **Every hash written anywhere goes stale**: merge messages ("merged as
  `7ff2ec2`"), `supabase/applied.mjs`, CLAUDE.md's worked examples, the morning
  files, BACKLOG.md, commit messages that cite other commits. The text still
  reads; the hashes stop resolving. A mapping file from filter-repo records old
  to new, and it would be kept beside the rewrite.
- **The 22 worktrees on this PC** (listed by `git worktree list`) all sit on
  rewritten branches. Each is re-created from the rewritten remote, and any
  uncommitted work in one is carried by hand first. Branches in flight on the
  day (today: the ordering pieces, `ci/cloud-board`, `fix/perf-session`,
  `fix/protocol-sources`, the calibration branch) are rebased onto the new main.
- **Vercel** builds from commits. Old deployments keep their old source inside
  Vercel, which is private to the team; new deployments build from new hashes.
  Nothing on the live site changes.

## What it cannot do

- **Anything already copied is not recalled.** The repository has 0 forks, 0
  stars and 0 watchers, which is the best case, but GitHub cannot report who
  has cloned or fetched a public repository.
- **GitHub keeps unreachable objects for a time and serves them by hash.** After
  the force push, the old commits stay viewable by anyone holding their URL
  until GitHub's own collection runs. GitHub Support can be asked to purge
  cached views and dangling objects; that request is the operator's to make.
- Search engines and archives may hold copies of a file's raw URL. Nothing here
  can see or remove those.

## What it needs, in order

1. Robert's word, naming the rewrite and the force push.
2. Item 1 of the same rulings landed first, so the current tree no longer
   carries the files and the registry verifies them from private storage.
3. A quiet moment: no board running, no branch about to merge.
4. The rewrite on a mirror clone, then verification that the three paths are
   absent from every ref (`git log --all -- <path>` empty), and that each
   rewritten branch's tree equals its old tree minus those paths.
5. The force push of every rewritten branch, then `git ls-remote` against the
   expected new heads, branch by branch.
6. The worktrees re-created; the mapping file committed; a dated note in
   CLAUDE.md that hashes before this date resolve through the mapping.
7. The GitHub Support request, by the operator.

## The lighter alternative

Leave history alone. Item 1 removes the files from the tree, so a reader of
the current repository no longer finds them, and the signature remains
reachable only to somebody walking old commits. That is the state until
Robert decides.
