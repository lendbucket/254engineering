/*
 * ===========================================================================
 * 0123: A PROSPECT IS ONE OF THE EIGHT VERTICALS.
 * Robert's CRM answer 8, 2026-11-02: "replace the prospect kind check with
 * the eight verticals; prepare it as a destructive sitting per
 * docs/production-sitting-destructive.md." Numbered 0122, last, by his
 * overnight order of 2026-11-05: "stage its operator_sql_editor script on
 * issue #1 for me and do not run it." Moved to 0123 by his answer 3 of
 * 2026-11-06, because the roofer rework takes 0117.
 * ===========================================================================
 *
 * eng_prospects_type_known (0079) allows roofer, agent, title and contractor.
 * R1's eight verticals (0112) could not fit it, so 0112 gave the vertical its
 * own column and check, and every write since has set prospect_type to the
 * nearest old value derived from the vertical (crm-rules.ts,
 * prospectTypeForVertical): roofer stays roofer, real_estate is written as
 * agent, and every other vertical is written as contractor. So `vertical` is
 * the truth on every row, and prospect_type is either a person's old choice or
 * that derived stand-in.
 *
 * THIS FILE, IN ORDER, ONE TRANSACTION:
 *   1. the old check is dropped (DESTRUCTIVE in shape: the connector cancels
 *      a drop, which is why this is run by the operator in the SQL editor);
 *   2. a row whose old kind was title keeps that fact as the tag
 *      title_company, and a row whose old kind was contractor and whose
 *      vertical is other keeps it as the tag contractor. Neither is one of the
 *      eight; both land on other. Those two mappings are the prepared sitting's
 *      (6588395003) and are marked there for Robert's eye;
 *   3. every row's prospect_type becomes its vertical, so the two columns say
 *      the same thing from here on;
 *   4. the new check, the eight values, under the old name;
 *   5. a closing assert that every row satisfies it and equals its vertical.
 *
 * Nothing is deleted: no row, no column, no table. The updates change one
 * column on rows that already exist and add a tag; eng_prospects_touch moves
 * their updated_at, as any edit does.
 *
 * Development first, then production, each by the operator_sql_editor route
 * with Robert approving the prompt, after this file's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_type_known') then
    raise exception 'eng: 0123 replaces eng_prospects_type_known (0079), which does not exist here.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_vertical_known') then
    raise exception 'eng: 0123 reads eng_prospects.vertical (0112), and its check does not exist here.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_prospects' and column_name = 'tags'
  ) then
    raise exception 'eng: 0123 keeps the old kind as a tag in eng_prospects.tags (0112), which does not exist here.';
  end if;
  if exists (select 1 from public.eng_prospects where prospect_type not in ('roofer', 'agent', 'title', 'contractor')) then
    raise exception 'eng: 0123 found a prospect kind outside the old four; something wrote what the old check should have refused. Nothing was changed.';
  end if;
end;
$$;

/* ------------------------------------------------------------ 1, the old check */

alter table eng_prospects drop constraint eng_prospects_type_known;

/* --------------------------------------------- 2, the two kinds not in the eight */

update eng_prospects
   set tags = array_append(tags, 'title_company')
 where prospect_type = 'title'
   and not ('title_company' = any (tags));

update eng_prospects
   set tags = array_append(tags, 'contractor')
 where prospect_type = 'contractor' and vertical = 'other'
   and not ('contractor' = any (tags));

/* ------------------------------------------------------ 3, the kind is the vertical */

update eng_prospects set prospect_type = vertical where prospect_type is distinct from vertical;

/* ------------------------------------------------------------ 4, the new check */

alter table eng_prospects
  add constraint eng_prospects_type_known
  check (prospect_type in (
    'roofer', 'solar', 'manufactured_home_dealer', 'foundation_repair',
    'real_estate', 'lender', 'insurance_agent', 'other'
  ));

comment on constraint eng_prospects_type_known on eng_prospects is
  'The eight verticals (Robert''s CRM answer 8, 2026-11-02), the same as eng_prospects_vertical_known. Replaced the four old kinds in 0123.';

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_prospects_type_known')) not like '%manufactured_home_dealer%'
     or pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_prospects_type_known')) like '%''agent''%' then
    raise exception 'eng: 0123 expects eng_prospects_type_known to hold the eight verticals and not the old kinds after it runs.';
  end if;
  if exists (select 1 from public.eng_prospects where prospect_type is distinct from vertical) then
    raise exception 'eng: 0123 expects every prospect''s kind to equal its vertical after it runs.';
  end if;
end;
$$;
