# Phase 10 Section 2: roles and permissions, the design

Report and stop, before anything is built. Operator steer of 2026-09-04 adopted,
and it is stronger than what I proposed: the licence bound capabilities are not
to be grantable-but-excluded, they are to be **unrepresentable**.

## The shape

Three parts, and the split is the whole design.

**Actions stay a closed typed union.** 49 today, minus the five below. A grant
row holding a typo is a compile error rather than a silent grant of nothing.

**Roles and grants become rows.** Owner creatable, owner editable, seven
defaults shipped. `Role` stops being `"admin" | "engineer" | "field_tech"` and
becomes a row with a name and a set of actions.

**The licence bound five leave the permission system entirely.** They are a
separate type that no grant, no screen and no role row can hold.

## The licence bound five, and why unrepresentable beats excluded

`protocols.author`, `protocols.publish`, `review.queue`, `review.decide`,
`documents.seal`.

These are bound to a Texas PE licence, not to a job title. The firm can hire a
dispatcher tomorrow; it cannot grant one the ability to seal.

The operator's argument, which I agree with and had not reached myself: if they
are grantable-but-excluded, **the exclusion is a check somebody can delete.** A
future session tidying a permission screen removes the filter and the checkbox
appears. If they are unrepresentable, there is nothing to delete, no checkbox to
hide, and no test to remember to keep.

### This is proved, not asserted

Before writing this down I built the type separation and compiled it.

```ts
type Action = "files.list" | "files.create" | ...;        // grantable
type LicensedAction = "documents.seal" | "review.decide" | ...;  // not

type Role = { name: string; grants: Action[] };

const forged: Role = {
  name: "Forged",
  // @ts-expect-error the licence bound actions are not grantable, by construction
  grants: ["files.list", "documents.seal"],
};
```

`tsc --strict` exits 0, meaning every `@ts-expect-error` was genuinely
satisfied. Then the negative: adding `documents.seal` back into `Action` makes
`tsc` report **TS2578 Unused '@ts-expect-error' directive** and exit non zero.

That second half matters more than the first. It means the guarantee cannot rot
silently: the day somebody makes a licensed action grantable, the build breaks
and names the line. The audit does not have to run anything, and there is no
runtime check to forget.

`can()` also cannot be handed a licensed action even by a caller who wants to,
which is what stops the 25 existing call sites drifting back.

### The one wrinkle, and how it is handled

`NavItem.action` is typed `Action`, and two nav entries point at licensed
screens (`/portal/review`, `/portal/protocols`). Nav takes
`Action | LicensedAction`.

Widening the nav does **not** widen the grant: `Role.grants` stays `Action[]`,
and the proof includes that case explicitly. A menu needs to know which screens
exist; a role needs to know what it may do. Those are different questions and
only the second decides anything.

## The seven default roles

| Role | Holds | Why |
| --- | --- | --- |
| **Administrator** | Everything grantable | The operator. Not everything *possible*: an administrator still cannot seal, and that is the point of the section |
| **Professional Engineer** | The licensed five, plus files, clients, review adjacent reads, protocols | The licence. The five come from holding this role, not from a grant |
| **Field technician** | Own jobs, own offers, evidence capture, own pay, own certifications | An independent contractor. Sees their own work and nothing about anybody else's |
| **Dispatcher** | Files read, dispatch, technicians, tasks, messages | Moves work to people. No money, no client pricing, no review |
| **Sales** | Clients read and write, files read and create, the intake, partners read | Brings work in and can open a job. Cannot price outside the catalog and cannot see margin |
| **Customer service** | Files read, clients read, messages, tasks, the outstanding information request | Answers the telephone about existing work. Can chase a customer, cannot open or price a job |
| **Read only** | Every `.list` and `.read`, nothing else | A buyer's accountant, an auditor, an incoming operations manager on their first week |

Administrator holding "everything grantable" is deliberate and is not a
loophole: the licensed five are not in the grantable set, so "everything" does
not include them. An administrator who needs to seal has to be a PE, which is
the correct sentence for a firm whose registration rests on one.

## What sales and customer service can and cannot see

The two roles a buyer will ask about, because they are the two that would be
hired first.

**A salesperson can:** find and create clients, open a file, take a job through
the intake, apply the catalog price, see whether a client has an account, see
partner attribution.

**A salesperson cannot:** see `tech_cost_cents`, `engineer_cost_cents` or any
margin figure. Override a price. Charge a card or invoice an account
(`payments.charge` is admin only, decided in Phase 10 Section 1). Reach the
review queue, the responsible charge log, or the audit trail.

The margin rule is the load bearing one. A salesperson who can see the spread
between what the client pays and what the technician is paid is a salesperson
negotiating against the firm's own costs, and it is not a conversation the firm
should have to have.

**Customer service can:** read files and clients, send messages, raise tasks,
send the outstanding information request, see order status.

**Customer service cannot:** create or price a job, dispatch, see costs, or
touch anything under review.

## Sensitive fields are filtered at the data layer, and one gap found

`redactFile` already deletes `PRICING_FIELDS` from a file before it is returned
to anybody without `pricing.read`. That is the right mechanism and it is already
where it should be: the row never reaches the view, so a template cannot leak it
by rendering the wrong variable.

**The gap.** Phase 10 Section 1 added `catalog_price_cents` and
`coastal_surcharge_cents` to `eng_files`, and `PRICING_FIELDS` lists neither.

There is no leak today: `FILE_COLUMNS` does not select them, so they never reach
`redactFile` to be missed by it. But that is an accident of what is read, not a
protection. The moment somebody adds them to `FILE_COLUMNS`, as I did for
`deliverable` two commits ago, they arrive on the row and are handed to whoever
asked.

**Recommendation: add both to `PRICING_FIELDS` before the read exists.** It is a
two line change and it removes a trap rather than fixing a hole. Held back only
because this section is report and stop; say the word and it goes in first.

The wider rule for Section 2: a role's grants decide what rows a query returns
and which columns survive, not what a component renders. `visibleFiles`,
`canSeeFile` and `redactFile` are the existing shape and the new roles plug into
them rather than adding a parallel mechanism.

## What happens to the three existing roles and the rows carrying them

Measured on both projects rather than assumed.

**Production holds exactly one profile: one active administrator.** That is the
operator. No engineers, no technicians.

**Development holds seven:** two administrators (one invited), one engineer,
four field technicians (one invited), all from `seed-field-demo`.

So the migration is small and the risk is concentrated in one row.

1. `eng_roles` and `eng_role_grants` are created and seeded with the seven
   defaults, with `admin`, `engineer` and `field_tech` keeping **exactly the
   grants they have today**, taken from the current `MATRIX` rather than
   rewritten. The three existing roles must behave identically on the day of the
   change or the migration has changed authorization while claiming to move it.
2. `eng_profiles.role` keeps its name and its values. `'admin'`, `'engineer'`
   and `'field_tech'` become the keys of the seeded rows rather than enum
   members, so **no profile row is rewritten and no session is invalidated.**
3. The `check` constraint on `eng_profiles.role` is replaced by a foreign key to
   `eng_roles`, which is what makes a role deletable-but-only-if-unused.
4. The four new roles are seeded inactive-but-available: they exist, nobody
   holds one, and the owner assigns them when the firm hires.

Nothing about the operator's own access changes at any point in that sequence,
which is the property to hold onto: the person applying the migration must not
be able to lock themselves out.

## The audit

`roles-audit` today enumerates 3 roles against 49 actions over HTTP and requires
every action to be declared in an expectation table. It grows rather than
changes:

- The matrix becomes 7 roles by 44 grantable actions, enumerated not sampled.
- The licensed five are asserted **at compile time** by the `@ts-expect-error`
  proof above, which lives in the repository as a real file rather than in this
  document.
- Injection verification: grant a permission wrongly in a seed row and watch the
  matrix fail on that exact pair.
- A new assertion that no route file contains role or permission logic of its
  own, in the shape `files-audit` already uses for `eng_files.status`.

## What a buyer looks for, and what will be true

- **Every access change in the audit trail with actor and timestamp.** Will be
  true: role changes and grant changes both write `writeAudit`.
- **Who could see what on a given date.** Will be *partly* true. The audit trail
  records each change, so the answer is reconstructible by replaying them. It is
  not queryable directly, and building that properly means effective dating the
  grants the way `eng_partner_terms` is dated. **Not in this section**, and the
  condition that would make it worth doing is a buyer or an insurer actually
  asking.
- **Immediate revocation.** Already true and stays true: `currentActor` reads
  the profile on every request, so a suspension or a role change takes effect on
  the next request rather than when a twelve hour cookie expires.
- **No shared accounts.** Already true structurally: every session is one
  profile, and the audit trail names it.

## The open question I am not deciding alone

`Role` stops being a union, so `homeFor(role)` and `ROLE_LABEL` stop being
exhaustive `Record<Role, ...>` maps and become lookups that can miss. The honest
options are a default landing route for an unknown role, or a `landing_path`
column on `eng_roles` so a new role must say where it lands.

I lean to the column: a role the owner created should not silently inherit
somebody else's home screen, and a default would make that the quiet behaviour.
It is one more field on the create-a-role form and it removes a class of
"why does the dispatcher land on the technician's screen" question.

Nothing is built. Say which way on the landing route, whether the
`PRICING_FIELDS` gap is fixed first, and whether the seven defaults are the
right seven.
