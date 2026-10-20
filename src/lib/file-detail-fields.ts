/**
 * The closed list of job details a member of staff may change with
 * files.update_details: contact, access and scheduling, by the operator's
 * ruling of 2026-10-20. Client safe, so the edit panel and the server read one
 * list. Ids are the ones data/intake-fields.ts and data/catalog.ts declare.
 */
export const FILE_DETAIL_FIELDS = [
  { id: "site_contact_name", label: "Who meets the technician", group: "contact" },
  { id: "site_contact_phone", label: "Their phone", group: "contact" },
  { id: "gate_code", label: "Gate code", group: "access" },
  { id: "dog_on_site", label: "Dog on site", group: "access" },
  { id: "alarm_on_site", label: "Alarm on site", group: "access" },
  { id: "access_notes", label: "How the technician gets in", group: "access" },
  { id: "appointment_window", label: "Appointment window", group: "scheduling" },
] as const;

export type FileDetailField = (typeof FILE_DETAIL_FIELDS)[number];
