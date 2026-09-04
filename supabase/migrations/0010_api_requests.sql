-- ===========================================================================
-- 0010: the ordering API's request log, which is also its rate limiter.
--
-- WHY A TABLE AND NOT MEMORY
-- --------------------------
-- The obvious rate limiter is a Map keyed by api key, and on this platform it
-- would do nothing. Every request runs in a function instance that may be new,
-- may be reused, and is certainly not the only one. A limit enforced in memory
-- is a limit that a second concurrent instance does not know about, so the real
-- ceiling is the limit times however many instances happen to exist. That is not
-- a rate limit; it is a comment.
--
-- The database is the only thing every instance shares, so the count lives here.
--
-- IT IS ALSO THE USAGE RECORD
-- ---------------------------
-- The same rows answer "how much is this account actually using the API", which
-- the operator's accounts screen wants and which nothing else in the platform
-- could tell them. Two purposes, one write, rather than a counter that discards
-- the detail and a log that duplicates it.
--
-- WHAT IT DELIBERATELY DOES NOT STORE
-- -----------------------------------
-- No request body. An order body carries a property address, a customer name and
-- a customer email, and this table exists to count requests rather than to hold
-- a second copy of everything the order tables already hold correctly. The
-- reference of anything created is enough to find the real record.
--
-- PRUNING IS NOT AUTOMATED, AND THAT IS RECORDED RATHER THAN HIDDEN
-- -----------------------------------------------------------------
-- At the volume this firm is starting with, a row per API request is nothing.
-- It will not stay nothing forever. There is no retention job here because a
-- deletion job written before anybody knows the shape of the traffic is a job
-- that deletes the wrong thing; BACKLOG carries it.
-- ===========================================================================

create table if not exists eng_account_api_requests (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  key_id        uuid not null references eng_account_api_keys(id) on delete cascade,
  account_id    uuid not null references eng_customer_accounts(id) on delete cascade,

  route         text not null,
  -- The HTTP status this platform answered. A refused request still counts
  -- against the limit, or a caller could hammer an endpoint with bad bodies.
  status        integer not null,
  -- Set when the request created something, so a row here can be traced to the
  -- real record without storing a copy of it.
  reference     text
);

/*
 * The index the limiter actually uses: recent rows for one key. Ordered
 * descending because the only question ever asked is "how many in the last
 * minute", which reads from the newest end.
 */
create index if not exists eng_account_api_requests_window_idx
  on eng_account_api_requests (key_id, created_at desc);

create index if not exists eng_account_api_requests_account_idx
  on eng_account_api_requests (account_id, created_at desc);

alter table eng_account_api_requests enable row level security;

comment on table eng_account_api_requests is
  'One row per ordering API request. Both the rate limit window and the usage record. Stores no request body: the order tables already hold that correctly.';
comment on column eng_account_api_requests.status is
  'A refused request counts against the limit too, or a caller could hammer the endpoint with bad bodies for free.';
