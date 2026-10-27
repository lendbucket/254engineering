/**
 * WHICH JOBS THE PAYMENT LINKS SCREEN LISTS, IN WHAT ORDER, AND WHICH WAY TO BE
 * PAID EACH ONE OFFERS, as pure functions so they can be proved.
 *
 * Robert's W2 ruling, 2026-10-27: "The first W2 screen is sending a payment link
 * and an account invoice. Today only code can send them." (docs/workflows.md,
 * 254-WF-008 step 4). The screen, its CSV and the buttons read these, and the
 * buttons call the door that already exists (/api/portal/files,
 * send_payment_link and invoice_account), which asks the same paymentOptions
 * again before anything is sent, so the screen can never offer what the door
 * would refuse.
 */
import { paymentOptions, type PaymentIntent, type PaymentOption } from "./job-intake-rules";

export type BillRow = {
  /** The file's id; named id because the staff table keys its rows on it. */
  id: string;
  fileNumber: string;
  createdAt: string;
  status: string;
  serviceSlug: string;
  deliverable: string | null;
  propertyAddress: string;
  county: string;
  /** Null is a job with no price, never zero. */
  priceCents: number | null;
  paymentIntent: PaymentIntent;
  paymentNote: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  /** The client has an active account on invoice terms, read the way invoiceAccount reads it. */
  accountCanInvoice: boolean;
};

export const BILL_INTENT_LABEL: Record<PaymentIntent, string> = {
  unset: "Not billed",
  released_unpaid: "Opened unpaid",
  link_sent: "Payment link sent",
  invoiced: "Invoiced to the account",
  paid: "Paid",
};

/** A job is waiting on money while it is not paid, not invoiced, and not cancelled or refused. */
const WAITING: readonly PaymentIntent[] = ["unset", "released_unpaid", "link_sent"];
const ENDED = ["cancelled", "refused", "closed"];

export function isWaiting(row: Pick<BillRow, "paymentIntent" | "status">): boolean {
  return WAITING.includes(row.paymentIntent) && !ENDED.includes(row.status);
}

export const BILL_SORTS = [
  { value: "opened", label: "Date opened" },
  { value: "amount", label: "Price" },
  { value: "client", label: "Client" },
  { value: "file", label: "File number" },
] as const;

export type BillListQuery = { q?: string; show?: string; sort?: string; dir?: string };

/**
 * Office ready, 2026-10-20: every list sorts, filters, searches and pages, and
 * the CSV is the same rows. Search covers the file number, the client's name,
 * email and telephone, and the address. A missing price sorts last in either
 * direction rather than as zero.
 */
export function billListRows(rows: readonly BillRow[], query: BillListQuery): BillRow[] {
  const needle = (query.q ?? "").trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const show = query.show ?? "waiting";
  const out = rows.filter((r) => {
    if (show === "waiting" && !isWaiting(r)) return false;
    if (show !== "waiting" && show !== "all" && r.paymentIntent !== show) return false;
    if (!needle) return true;
    const text = [r.fileNumber, r.clientName, r.clientEmail, r.propertyAddress, r.county].some((v) =>
      (v ?? "").toLowerCase().includes(needle),
    );
    const phone = digits.length >= 4 && (r.clientPhone ?? "").replace(/\D/g, "").includes(digits);
    return text || phone;
  });
  const dir = query.dir === "asc" ? 1 : -1;
  const sort = query.sort ?? "opened";
  const key = (r: BillRow): string | number | null =>
    sort === "amount" ? r.priceCents : sort === "client" ? r.clientName.toLowerCase() : sort === "file" ? r.fileNumber : r.createdAt;
  out.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null && kb === null) return a.id < b.id ? -1 : 1;
    if (ka === null) return 1;
    if (kb === null) return -1;
    if (ka < kb) return -dir;
    if (ka > kb) return dir;
    return a.id < b.id ? -1 : 1;
  });
  return out;
}

/**
 * The two ways to be paid this screen offers for one job, each with whether it
 * is open and, when it is not, the reason in the words the door will use. The
 * third option paymentOptions knows, opening a job unpaid, belongs to the
 * intake and is not offered here.
 *
 * A link needs an address to send it to, which paymentOptions does not ask
 * because the intake always has one; the door refuses without it, so this says
 * so first.
 */
export function billChoices(row: BillRow, prelaunch: boolean): PaymentOption[] {
  return paymentOptions({ prelaunch, accountCanInvoice: row.accountCanInvoice, priced: row.priceCents !== null })
    .filter((o) => o.intent === "link_sent" || o.intent === "invoiced")
    .map((o) => {
      if (!o.available) return o;
      if (row.paymentIntent === "link_sent" || row.paymentIntent === "invoiced" || row.paymentIntent === "paid") {
        return { ...o, available: false, because: ALREADY_BILLED };
      }
      if (!row.clientEmail) {
        return { ...o, available: false, because: "That client has no email address, so there is nowhere to send a link or an invoice." };
      }
      return o;
    });
}

const ALREADY_BILLED =
  "This job has already been billed. Send the existing order's link again from Order lookup rather than raising a second order, which is how a customer ends up paying twice.";

/**
 * THE DOOR'S OWN GUARD AGAINST A SECOND ORDER FOR ONE JOB, as a sentence or null.
 *
 * sendPaymentLink and invoiceAccount each raise a NEW order. Before this screen
 * the only caller was the intake, once, on a file that had none; a screen with a
 * button is a door somebody can press twice, and the code had said in its own
 * comment that a second order is "how a customer ends up paying twice". So the
 * door asks first whether the job already has an order that is not cancelled or
 * refunded, and refuses naming it. Those two are the only ends that leave the
 * job unbilled again.
 */
export function alreadyRaised(orders: readonly { reference: string; status: string }[]): string | null {
  const live = orders.find((o) => o.status !== "cancelled" && o.status !== "refunded");
  return live
    ? `Order ${live.reference} was already raised against this job and is ${live.status.replace(/_/g, " ")}. ${ALREADY_BILLED.replace("This job has already been billed. ", "")}`
    : null;
}
