import { cleanSearchTerm } from "./search-rules";

/**
 * ===========================================================================
 * FOUR MORE STAFF LISTS SORT, FILTER, SEARCH AND PAGE. Office ready, operator
 * ruling of 2026-10-20 (CLAUDE.md section 2d): "Every list sorts, filters,
 * searches and pages." People, do not contact, asked to be forgotten, and
 * credential review had none of the four.
 * ===========================================================================
 *
 * Each of these is a register the firm keeps whole (staff accounts, consent
 * records, requests, a verification queue), so its screen reads every row and
 * the search, filter, sort and paging run here on what came back, as the
 * technician roster's does (tech-list.ts). That keeps every count on the
 * screen a count of the whole matching set rather than of a page: the pager
 * says "of 312", never "of 50".
 *
 * One engine and four specs, rather than four copies of it, so the four lists
 * cannot drift apart in how a search is read or a page is cut. Pure: a proof
 * hands it rows and a query and reads what comes back.
 */

export const STAFF_LIST_PAGE_SIZE = 50;

export type StaffListParams = Record<string, string | undefined>;

export type StaffListSpec<T> = {
  /** The text a search looks in, per row. */
  text: (row: T) => readonly (string | null | undefined)[];
  /** Each filter's values and the rule for each; the empty value is "all" and needs no rule. */
  filters: Record<string, Record<string, (row: T) => boolean>>;
  /**
   * Each sort's key and its natural direction. The key is given the row's
   * place in the read, so "the order it was read in" is a sort like any other.
   * A null key sorts last whichever way the list runs, so a missing date never
   * heads a list as if it were the earliest.
   */
  sorts: Record<string, { key: (row: T, readAt: number) => string | number | null; ascending: boolean }>;
  defaultSort: string;
};

export type StaffListQuery = {
  term: string;
  filters: Record<string, string>;
  sort: string;
  ascending: boolean;
  page: number;
};

export function staffListQuery<T>(params: StaffListParams, spec: StaffListSpec<T>): StaffListQuery {
  const filters: Record<string, string> = {};
  for (const [name, values] of Object.entries(spec.filters)) {
    const v = params[name] ?? "";
    filters[name] = v in values ? v : "";
  }
  const sort = params.sort && params.sort in spec.sorts ? params.sort : spec.defaultSort;
  const ascending = params.dir === "asc" ? true : params.dir === "desc" ? false : spec.sorts[sort].ascending;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  return { term: cleanSearchTerm(params.q ?? "").toLowerCase(), filters, sort, ascending, page };
}

/** Every row the query matches, in its order. What the screen pages and what the file exports. */
export function staffListRows<T>(rows: readonly T[], query: StaffListQuery, spec: StaffListSpec<T>): T[] {
  const matched = rows
    .map((row, readAt) => ({ row, readAt }))
    .filter(({ row }) => {
      for (const [name, value] of Object.entries(query.filters)) {
        if (value && !spec.filters[name][value](row)) return false;
      }
      if (!query.term) return true;
      return spec.text(row).some((t) => (t ?? "").toLowerCase().includes(query.term));
    });
  const { key } = spec.sorts[query.sort];
  const dir = query.ascending ? 1 : -1;
  matched.sort((a, b) => {
    const x = key(a.row, a.readAt);
    const y = key(b.row, b.readAt);
    if (x === null || y === null) {
      if (x === y) return a.readAt - b.readAt;
      return x === null ? 1 : -1;
    }
    const byKey = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en-US", { sensitivity: "base" });
    return byKey !== 0 ? byKey * dir : a.readAt - b.readAt;
  });
  return matched.map((m) => m.row);
}

/** One page of the matching rows. The total is the size of the matching set, never the length of the page. */
export function staffListPage<T>(matching: readonly T[], page: number): { rows: T[]; page: number; pages: number; total: number } {
  const total = matching.length;
  const pages = Math.max(1, Math.ceil(total / STAFF_LIST_PAGE_SIZE));
  const at = Math.min(Math.max(1, page), pages);
  const from = (at - 1) * STAFF_LIST_PAGE_SIZE;
  return { rows: matching.slice(from, from + STAFF_LIST_PAGE_SIZE), page: at, pages, total };
}

/* ------------------------------------------------------------------ the specs */

export type PersonListRow = {
  email: string;
  display_name: string;
  role: string;
  status: "invited" | "active" | "suspended";
  phone: string | null;
  base_county: string | null;
  last_sign_in_at: string | null;
  created_at: string;
};

export const PEOPLE_LIST: StaffListSpec<PersonListRow> = {
  text: (p) => [p.display_name, p.email, p.phone, p.base_county],
  filters: {
    status: {
      active: (p) => p.status === "active",
      invited: (p) => p.status === "invited",
      suspended: (p) => p.status === "suspended",
    },
  },
  sorts: {
    added: { key: (p) => p.created_at, ascending: false },
    name: { key: (p) => p.display_name, ascending: true },
    seen: { key: (p) => p.last_sign_in_at, ascending: false },
  },
  defaultSort: "added",
};

export type SuppressionListRow = { email: string; because: string; createdAt: string; enteredByOperator: boolean; voided: unknown };

export const SUPPRESSION_LIST: StaffListSpec<SuppressionListRow> = {
  text: (r) => [r.email, r.because],
  filters: {
    source: {
      clicked: (r) => !r.enteredByOperator,
      recorded: (r) => r.enteredByOperator,
    },
    state: {
      standing: (r) => !r.voided,
      mistake: (r) => Boolean(r.voided),
    },
  },
  sorts: {
    added: { key: (r) => r.createdAt, ascending: false },
    email: { key: (r) => r.email, ascending: true },
  },
  defaultSort: "added",
};

export type DeletionListRow = { subjectEmail: string; subjectNote: string | null; askedFor: string; answered: unknown; suppressed: boolean };

export const DELETION_LIST: StaffListSpec<DeletionListRow> = {
  text: (r) => [r.subjectEmail, r.subjectNote, r.askedFor],
  filters: {
    answer: {
      waiting: (r) => !r.answered,
      answered: (r) => Boolean(r.answered),
    },
  },
  sorts: {
    /* The read is newest first, and the request carries its date only as text, so received is the read's own order. */
    received: { key: (_r, readAt) => readAt, ascending: true },
    email: { key: (r) => r.subjectEmail, ascending: true },
  },
  defaultSort: "received",
};

export type PolicyListRow = { kind: string; carrier: string; policyNumber: string; namedInsureds: readonly string[]; expiresOn: string; withdrawnAt: string | null };

/** Whether a policy is in force depends on the firm's today, so the spec is made for a day. Dates are ISO, so text order is date order. */
export function policyList(today: string): StaffListSpec<PolicyListRow> {
  return {
    text: (p) => [p.kind, p.carrier, p.policyNumber, ...p.namedInsureds],
    filters: {
      standing: {
        force: (p) => !p.withdrawnAt && p.expiresOn >= today,
        expired: (p) => !p.withdrawnAt && p.expiresOn < today,
        withdrawn: (p) => Boolean(p.withdrawnAt),
      },
    },
    sorts: {
      expires: { key: (p) => p.expiresOn, ascending: false },
      carrier: { key: (p) => p.carrier, ascending: true },
    },
    defaultSort: "expires",
  };
}

export type CredentialListRow = { name: string; label: string; issuingState: string | null; expiresOn: string | null; submittedAt: string };

export const CREDENTIAL_LIST: StaffListSpec<CredentialListRow> = {
  text: (r) => [r.name, r.label, r.issuingState],
  filters: {
    expiry: {
      dated: (r) => r.expiresOn !== null,
      undated: (r) => r.expiresOn === null,
    },
  },
  sorts: {
    submitted: { key: (r) => r.submittedAt, ascending: true },
    name: { key: (r) => r.name, ascending: true },
    expires: { key: (r) => r.expiresOn, ascending: true },
  },
  defaultSort: "submitted",
};
