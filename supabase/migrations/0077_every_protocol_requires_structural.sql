/*
 * ===========================================================================
 * 0077  THE ENGINEER OF RECORD STATES THE DISCIPLINE EVERY PROTOCOL REQUIRES.
 * ===========================================================================
 *
 * The same act as 0056, for the eight protocols on the signable list. The
 * value is not inferred from any protocol's title: it is the engineer's
 * answer, given on 2026-10-14 to the question the operator sent him that day,
 * recorded in src/config/engineer-directions.ts under
 * "every-service-is-structural" with its evidence digested there.
 *
 * HIS WORDS: "Everything we do will be under structural as we will be doing structural observations and structural calculations if required. We won’t be covering any architectural or MEP aspects in any of the services."
 *
 * THE EVIDENCE IS THE OPERATOR'S ATTESTATION OF THOSE WORDS, and that is said
 * plainly: docs/compliance/2026-10-14-operator-attestation-aman-required-
 * discipline.txt, saved on the operator's instruction. The email is not on disk.
 *
 * THE EIGHT ROWS, each found by its document's SHA-256, never by its number
 * alone (DISCIPLINE_BY_PROTOCOL in engineer-directions.ts, which
 * protocol-registry-audit reads back against this file):
 *   254-MH-001 v1.1, 254-SL-001 v1.1, 254-PL-001 v1.1, 254-RS-001 v1.1,
 *   254-DS-001 v1.1, 254-WS-001 v1.1   (entered by 0065)
 *   254-WP-001 v1.2, 254-FC-001 v1.0   (entered by 0069)
 *
 * NOT 254-WP-001 v1.1, by the operator's ruling of 2026-10-14: v1.2
 * supersedes it and it will never be signed or approved. Its discipline stays
 * null, and this file asserts that. NOT 254-RC-001, which 0056 already set.
 *
 * NOTHING IS APPROVED BY THIS MIGRATION. No status, approver or date moves.
 * Stating which discipline a protocol requires is not approving it, and the
 * approval remains an act in his own session through eng_approve_protocol,
 * which still checks his declared competence against this value.
 */

/*
 * ASSERT THE TARGETS BEFORE WRITING. Each row must exist exactly once under
 * its declared digest and carry no discipline yet. A migration that silently
 * updated nothing, or overwrote a value somebody else set, would be
 * indistinguishable from one that worked.
 */
do $$
declare
  t record;
  n integer;
begin
  for t in
    select * from (values
      ('254-MH-001', '1.1', '5c88c73d9815cfae6825ef82d4368dd66a98dce746deed91b3c351cf2df09d4a'),
      ('254-SL-001', '1.1', '7bac29a7021086a7a40906021de5be9c2c2efaba747db33877410dd7b5c4e8f3'),
      ('254-PL-001', '1.1', 'f1ff2e5883aac06ac1b468a74ea09535c074a468a31de4c04297bf4c74b11387'),
      ('254-RS-001', '1.1', 'c7913d6637f2a08b1cd09a49c1767c682895db864143005a07bba99def8c2dd2'),
      ('254-DS-001', '1.1', '37dd6b2e44155108df1daa681277332ddb64450a0f58813979e538da469ee22b'),
      ('254-WS-001', '1.1', 'f4cbe248957298bbae6d968350d3732ef3197b46684959c6ec083f494f3ed6b5'),
      ('254-WP-001', '1.2', '635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4'),
      ('254-FC-001', '1.0', '264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d')
    ) as v(doc, ver, sha)
  loop
    select count(*) into n
    from eng_protocol_templates
    where document_number = t.doc
      and version_label   = t.ver
      and document_sha256 = t.sha
      and requires_discipline is null;
    if n <> 1 then
      raise exception
        'eng: expected exactly one % v% under the declared digest with no discipline yet, found %.',
        t.doc, t.ver, n;
    end if;
  end loop;
end;
$$;

update eng_protocol_templates
   set requires_discipline = 'structural'
 where requires_discipline is null
   and (document_number, version_label, document_sha256) in (
     ('254-MH-001', '1.1', '5c88c73d9815cfae6825ef82d4368dd66a98dce746deed91b3c351cf2df09d4a'),
     ('254-SL-001', '1.1', '7bac29a7021086a7a40906021de5be9c2c2efaba747db33877410dd7b5c4e8f3'),
     ('254-PL-001', '1.1', 'f1ff2e5883aac06ac1b468a74ea09535c074a468a31de4c04297bf4c74b11387'),
     ('254-RS-001', '1.1', 'c7913d6637f2a08b1cd09a49c1767c682895db864143005a07bba99def8c2dd2'),
     ('254-DS-001', '1.1', '37dd6b2e44155108df1daa681277332ddb64450a0f58813979e538da469ee22b'),
     ('254-WS-001', '1.1', 'f4cbe248957298bbae6d968350d3732ef3197b46684959c6ec083f494f3ed6b5'),
     ('254-WP-001', '1.2', '635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4'),
     ('254-FC-001', '1.0', '264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d')
   );

/*
 * AND ASSERT WHAT WE JUST DID, because an UPDATE with a WHERE clause is silent
 * about whether it matched anything: the eight carry structural, and WP-001
 * v1.1 still carries nothing.
 */
do $$
declare
  n integer;
begin
  select count(*) into n
  from eng_protocol_templates
  where requires_discipline = 'structural'
    and (document_number, version_label) in (
      ('254-MH-001', '1.1'), ('254-SL-001', '1.1'), ('254-PL-001', '1.1'), ('254-RS-001', '1.1'),
      ('254-DS-001', '1.1'), ('254-WS-001', '1.1'), ('254-WP-001', '1.2'), ('254-FC-001', '1.0')
    );
  if n <> 8 then
    raise exception 'eng: % of the eight protocols carry structural, and all eight are required.', n;
  end if;

  select count(*) into n
  from eng_protocol_templates
  where document_number = '254-WP-001' and version_label = '1.1' and requires_discipline is not null;
  if n <> 0 then
    raise exception 'eng: 254-WP-001 v1.1 carries a discipline, and by ruling it carries none.';
  end if;
end;
$$;
