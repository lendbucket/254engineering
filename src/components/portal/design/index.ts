/**
 * The portal design system.
 *
 * One import site, so a screen says `from "@/components/portal/design"` and a
 * reader can see at a glance which screens are on the system and which are
 * still on the old styling. token-audit's PORTED list is the machine readable
 * version of the same question.
 */
export {
  PrimaryButton,
  SecondaryButton,
  ToolbarButton,
  StatusDot,
  StatusPill,
  SystemAlert,
  AbsentChip,
  MoneyFigure,
  ExclusionNote,
  Panel,
  Figure,
  type StatusTone,
} from "./Primitives";

export { DataTable, TableFooter, EmptyState, ErrorState, type Column } from "./Table";

export {
  Breadcrumb,
  RecordHeader,
  FieldGrid,
  Timeline,
  DocumentSheet,
  SheetLetterhead,
  SheetRecordNote,
} from "./Record";
