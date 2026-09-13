-- Supabase SQL schema for Chat app (email-based auth + contacts + 1:1 messages)
-- Run this in Supabase Dashboard -> SQL Editor.

-- Uses Supabase as a Postgres database ONLY (no Supabase Auth required).

create extension if not exists pgcrypto;

-- 1) Users / Profiles (our app auth lives in Node.js + JWT)
-- NOTE: If you already created `public.profiles` with an older schema, the
-- `create table if not exists` won't change it. The ALTERs below ensure the
-- required columns exist (fixes: "column profiles.email_verified does not exist").
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null
);

-- If you previously used Supabase Auth (or an older schema) you might have:
--   profiles.id -> users.id (or auth.users.id) foreign key constraint
-- That breaks custom auth (Node creates UUIDs), so we drop it if present.
alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.profiles add column if not exists password_hash text;
alter table public.profiles add column if not exists email_verified boolean not null default false;
alter table public.profiles add column if not exists name text not null default '';
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_bucket text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists avatar_updated_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- 2) Email OTPs (signup verification)
create table if not exists public.email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

-- If you created `public.email_otps` earlier with missing columns, ensure they exist:
alter table public.email_otps add column if not exists otp_hash text;
alter table public.email_otps add column if not exists expires_at timestamptz;
alter table public.email_otps add column if not exists created_at timestamptz not null default now();
alter table public.email_otps add column if not exists consumed_at timestamptz;

create index if not exists email_otps_email_purpose_created_at_idx
  on public.email_otps (email, purpose, created_at desc);
create index if not exists email_otps_active_lookup_idx
  on public.email_otps (email, purpose, expires_at desc)
  where consumed_at is null;
create index if not exists email_otps_expires_at_idx
  on public.email_otps (expires_at);

-- 3) Contacts (owner adds contact)
create table if not exists public.contacts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  primary key (owner_id, contact_id)
);

-- If `contacts` existed earlier and referenced `users`/`auth.users`, rewire FK to `profiles`.
alter table public.contacts drop constraint if exists contacts_owner_id_fkey;
alter table public.contacts drop constraint if exists contacts_contact_id_fkey;
alter table public.contacts
  add constraint contacts_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;
alter table public.contacts
  add constraint contacts_contact_id_fkey foreign key (contact_id) references public.profiles(id) on delete cascade;

-- Optional: user can "delete/clear chat" like WhatsApp (local delete),
-- by setting `contacts.cleared_at` which hides older messages for that owner+contact.
alter table public.contacts add column if not exists cleared_at timestamptz;

-- 4) Messages (1:1)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  deleted_for_everyone_at timestamptz,
  deleted_for_everyone_by uuid,
  file_bucket text,
  file_path text,
  file_name text,
  file_mime text,
  file_size bigint,
  file_kind text
);

-- If `messages` existed earlier and referenced `users`/`auth.users`, rewire FK to `profiles`.
alter table public.messages drop constraint if exists messages_from_id_fkey;
alter table public.messages drop constraint if exists messages_to_id_fkey;
alter table public.messages
  add constraint messages_from_id_fkey foreign key (from_id) references public.profiles(id) on delete cascade;
alter table public.messages
  add constraint messages_to_id_fkey foreign key (to_id) references public.profiles(id) on delete cascade;

-- If `messages` existed earlier, ensure status columns exist:
alter table public.messages add column if not exists delivered_at timestamptz;
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages add column if not exists deleted_for_everyone_at timestamptz;
alter table public.messages add column if not exists deleted_for_everyone_by uuid;
alter table public.messages add column if not exists file_bucket text;
alter table public.messages add column if not exists file_path text;
alter table public.messages add column if not exists file_name text;
alter table public.messages add column if not exists file_mime text;
alter table public.messages add column if not exists file_size bigint;
alter table public.messages add column if not exists file_kind text;

create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_from_to_idx on public.messages (from_id, to_id, created_at desc);
create index if not exists messages_to_read_idx on public.messages (to_id, read_at, created_at desc);
create index if not exists messages_file_path_idx on public.messages (file_path);

-- 4b) Per-message local deletes (Delete for me)
create table if not exists public.message_deletes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_deletes_user_id_deleted_at_idx
  on public.message_deletes (user_id, deleted_at desc);

-- 6) Groups (multi-user)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  cleared_at timestamptz,
  primary key (group_id, user_id)
);

alter table public.group_members add column if not exists last_read_at timestamptz;
alter table public.group_members add column if not exists cleared_at timestamptz;

create index if not exists group_members_user_id_idx on public.group_members (user_id);
create index if not exists group_members_group_id_idx on public.group_members (group_id);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  deleted_for_everyone_at timestamptz,
  deleted_for_everyone_by uuid,
  file_bucket text,
  file_path text,
  file_name text,
  file_mime text,
  file_size bigint,
  file_kind text
);

alter table public.group_messages add column if not exists deleted_for_everyone_at timestamptz;
alter table public.group_messages add column if not exists deleted_for_everyone_by uuid;
alter table public.group_messages add column if not exists file_bucket text;
alter table public.group_messages add column if not exists file_path text;
alter table public.group_messages add column if not exists file_name text;
alter table public.group_messages add column if not exists file_mime text;
alter table public.group_messages add column if not exists file_size bigint;
alter table public.group_messages add column if not exists file_kind text;

create index if not exists group_messages_created_at_idx on public.group_messages (created_at desc);
create index if not exists group_messages_group_id_created_at_idx on public.group_messages (group_id, created_at desc);
create index if not exists group_messages_file_path_idx on public.group_messages (file_path);

-- 6b) Per-group-message local deletes (Delete for me)
create table if not exists public.group_message_deletes (
  group_message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (group_message_id, user_id)
);

create index if not exists group_message_deletes_user_id_deleted_at_idx
  on public.group_message_deletes (user_id, deleted_at desc);

-- 7) Calls (1:1 call history)
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  media text not null default 'audio', -- audio | video
  status text not null default 'ringing', -- ringing | connected | ended | busy | cancelled | declined | missed
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text
);

create index if not exists call_logs_created_at_idx on public.call_logs (created_at desc);
create index if not exists call_logs_from_id_created_at_idx on public.call_logs (from_id, created_at desc);
create index if not exists call_logs_to_id_created_at_idx on public.call_logs (to_id, created_at desc);

-- Per-call local deletes (Delete from call history for me)
create table if not exists public.call_log_deletes (
  call_log_id uuid not null references public.call_logs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (call_log_id, user_id)
);

create index if not exists call_log_deletes_user_id_deleted_at_idx
  on public.call_log_deletes (user_id, deleted_at desc);

-- 8) Production-style data integrity constraints (added as NOT VALID so older rows
-- don't block rollout; new writes are still checked immediately).
do $$
begin
  alter table public.profiles
    add constraint profiles_email_lowercase_check
    check (email = lower(email)) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_name_length_check
    check (char_length(name) <= 32) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_bio_length_check
    check (char_length(bio) <= 160) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public' and indexname = 'profiles_email_lower_unique_idx'
  ) and not exists (
    select lower(email)
    from public.profiles
    group by lower(email)
    having count(*) > 1
  ) then
    create unique index profiles_email_lower_unique_idx on public.profiles (lower(email));
  end if;
end $$;

do $$
begin
  alter table public.email_otps
    add constraint email_otps_email_lowercase_check
    check (email = lower(email)) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.email_otps
    add constraint email_otps_purpose_length_check
    check (char_length(trim(purpose)) between 1 and 32) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.email_otps
    add constraint email_otps_hash_length_check
    check (char_length(otp_hash) = 64) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.contacts
    add constraint contacts_owner_not_contact_check
    check (owner_id <> contact_id) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_sender_not_receiver_check
    check (from_id <> to_id) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_text_length_check
    check (char_length(text) <= 1000) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_file_size_check
    check (file_size is null or (file_size >= 0 and file_size <= 52428800)) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_file_kind_check
    check (file_kind is null or file_kind in ('image', 'video', 'audio', 'file')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_delete_for_everyone_shape_check
    check (
      (deleted_for_everyone_at is null and deleted_for_everyone_by is null)
      or (deleted_for_everyone_at is not null and deleted_for_everyone_by = from_id)
    ) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.groups
    add constraint groups_name_length_check
    check (char_length(trim(name)) between 1 and 48) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.group_members
    add constraint group_members_role_check
    check (role in ('admin', 'member')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.group_messages
    add constraint group_messages_text_length_check
    check (char_length(text) <= 1000) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.group_messages
    add constraint group_messages_file_size_check
    check (file_size is null or (file_size >= 0 and file_size <= 52428800)) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.group_messages
    add constraint group_messages_file_kind_check
    check (file_kind is null or file_kind in ('image', 'video', 'audio', 'file')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.group_messages
    add constraint group_messages_delete_for_everyone_shape_check
    check (
      (deleted_for_everyone_at is null and deleted_for_everyone_by is null)
      or (deleted_for_everyone_at is not null and deleted_for_everyone_by = from_id)
    ) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.call_logs
    add constraint call_logs_peer_check
    check (from_id <> to_id) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.call_logs
    add constraint call_logs_media_check
    check (media in ('audio', 'video')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.call_logs
    add constraint call_logs_status_check
    check (status in ('ringing', 'connected', 'ended', 'busy', 'cancelled', 'declined', 'missed')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.call_logs
    add constraint call_logs_ended_by_participant_check
    check (ended_by is null or ended_by in (from_id, to_id)) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.call_logs
    add constraint call_logs_end_after_create_check
    check (ended_at is null or ended_at >= created_at) not valid;
exception when duplicate_object then null;
end $$;

-- 5) (Recommended) Lock tables behind the server using RLS
alter table public.profiles enable row level security;
alter table public.email_otps enable row level security;
alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.message_deletes enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_message_deletes enable row level security;
alter table public.call_logs enable row level security;
alter table public.call_log_deletes enable row level security;

-- No policies added on purpose (deny by default for anon/authenticated).
-- Server uses the service role key which bypasses RLS.
