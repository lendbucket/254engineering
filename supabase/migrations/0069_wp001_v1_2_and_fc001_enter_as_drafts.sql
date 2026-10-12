/*
 * ===========================================================================
 * 0069: 254-WP-001 v1.2 AND 254-FC-001 v1.0 ENTER AS DRAFTS. Operator ruling,
 * 2026-10-10.
 * ===========================================================================
 *
 * The engineer's two new protocols arrived as Word files, and the .docx is the
 * source of record: its SHA-256 is the document digest recorded here. Each is
 * transcribed verbatim into src/content/protocols/docx-received.ts and proved
 * word for word against the .docx by protocol-registry-audit section 9.
 *
 *   254-WP-001 v1.2, Windstorm Inspection Protocol, ongoing construction,
 *     issued 2026-10-09, sha256 635168e3...57c4. Supersedes v1.1 (0065).
 *   254-FC-001 v1.0, Foundation Certification Protocol for Existing
 *     Foundations, issued 2026-09-29, sha256 264d3b5d...bf8d. First issue for
 *     the foundation line (foundation-inspections).
 *
 * DRAFTS, BY 0049's VOCABULARY: draft means the engineer has not signed. A
 * draft carries no signature, approver or publication date and opens no line.
 * Each is entered the way 0065 entered the seven: refused if a row already
 * records the same document and version under a different digest, inserted
 * once, and read back.
 *
 * ADDITIVE: two rows. No schema change.
 */

-- 254-WP-001 v1.2: Windstorm Inspection Protocol for Certificates of Compliance (Form WPI-8), Ongoing Construction
do $$
declare
  wrong integer;
begin
  select count(*) into wrong
  from eng_protocol_templates
  where document_number = '254-WP-001'
    and version_label   = '1.2'
    and document_sha256 is distinct from '635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4';
  if wrong > 0 then
    raise exception
      'eng: % row(s) already record 254-WP-001 v1.2 under a different document digest. Somebody must decide which document this protocol is.',
      wrong;
  end if;
end;
$$;

insert into eng_protocol_templates (
  service_slug, name, version, version_label, status, summary, document_number, issue_date, document_sha256, firm_name_on_document, requires_discipline, document_signed_at
)
select
  'windstorm-wpi-8', 'Windstorm Inspection Protocol for Certificates of Compliance (Form WPI-8), Ongoing Construction',
  coalesce((select max(version) from eng_protocol_templates where service_slug = 'windstorm-wpi-8'), 0) + 1,
  '1.2', 'draft',
  '254-WP-001 v1.2, issued 2026-10-09, received as a Word file, the source of record. A draft until the engineer signs it in the portal. Covers the ongoing construction tier of this line. Supersedes v1.1.',
  '254-WP-001', '2026-10-09', '635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4',
  '254 Engineering Services', null, null
where not exists (
  select 1 from eng_protocol_templates where document_number = '254-WP-001' and version_label = '1.2'
);

do $$
declare
  n integer;
begin
  select count(*) into n
  from eng_protocol_templates
  where document_number = '254-WP-001'
    and version_label   = '1.2'
    and status          = 'draft'
    and document_sha256 = '635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4';
  if n <> 1 then
    raise exception 'eng: % draft row(s) record 254-WP-001 v1.2 with its digest and exactly one is required.', n;
  end if;
end;
$$;

-- 254-FC-001 v1.0: Foundation Certification Protocol for Existing Foundations
do $$
declare
  wrong integer;
begin
  select count(*) into wrong
  from eng_protocol_templates
  where document_number = '254-FC-001'
    and version_label   = '1.0'
    and document_sha256 is distinct from '264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d';
  if wrong > 0 then
    raise exception
      'eng: % row(s) already record 254-FC-001 v1.0 under a different document digest. Somebody must decide which document this protocol is.',
      wrong;
  end if;
end;
$$;

insert into eng_protocol_templates (
  service_slug, name, version, version_label, status, summary, document_number, issue_date, document_sha256, firm_name_on_document, requires_discipline, document_signed_at
)
select
  'foundation-inspections', 'Foundation Certification Protocol for Existing Foundations',
  coalesce((select max(version) from eng_protocol_templates where service_slug = 'foundation-inspections'), 0) + 1,
  '1.0', 'draft',
  '254-FC-001 v1.0, issued 2026-09-29, received as a Word file, the source of record. A draft until the engineer signs it in the portal. First issue for this line.',
  '254-FC-001', '2026-09-29', '264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d',
  '254 Engineering Services', null, null
where not exists (
  select 1 from eng_protocol_templates where document_number = '254-FC-001' and version_label = '1.0'
);

do $$
declare
  n integer;
begin
  select count(*) into n
  from eng_protocol_templates
  where document_number = '254-FC-001'
    and version_label   = '1.0'
    and status          = 'draft'
    and document_sha256 = '264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d';
  if n <> 1 then
    raise exception 'eng: % draft row(s) record 254-FC-001 v1.0 with its digest and exactly one is required.', n;
  end if;
end;
$$;
