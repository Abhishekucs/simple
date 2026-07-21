create table public.journal_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  title text not null default 'Untitled',
  content_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_pages_user_filename_key unique (user_id, filename),
  constraint journal_pages_filename_markdown check (filename ~* '\.md$'),
  constraint journal_pages_title_length check (char_length(title) between 1 and 160)
);

create index journal_pages_user_updated_at_idx
  on public.journal_pages (user_id, updated_at desc);

create function public.set_journal_page_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_journal_page_updated_at
before update on public.journal_pages
for each row
execute function public.set_journal_page_updated_at();

revoke all on table public.journal_pages from anon, authenticated;
grant select, insert, update on table public.journal_pages to authenticated;

alter table public.journal_pages enable row level security;

create policy "Users can read their own journal pages"
on public.journal_pages
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own journal pages"
on public.journal_pages
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own journal pages"
on public.journal_pages
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
