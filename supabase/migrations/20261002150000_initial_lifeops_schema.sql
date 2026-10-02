create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  pronouns text null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text null,
  due_date date null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint tasks_title_not_empty check (length(trim(title)) > 0)
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_user_due_date_idx on public.tasks (user_id, due_date);
create index tasks_user_completed_idx on public.tasks (user_id, completed);
create index tasks_user_created_at_idx on public.tasks (user_id, created_at desc);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  frequency text not null default 'Daily',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint habits_frequency_valid check (frequency in ('Daily', 'Weekdays', 'Weekly'))
);

create index habits_user_id_idx on public.habits (user_id);
create index habits_user_archived_at_idx on public.habits (user_id, archived_at);

create table public.habit_completions (
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, completed_on)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text null,
  area text not null default 'Personal',
  target numeric not null default 10,
  progress numeric not null default 0,
  deadline date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint goals_title_not_empty check (length(trim(title)) > 0),
  constraint goals_target_positive check (target > 0),
  constraint goals_progress_non_negative check (progress >= 0),
  constraint goals_progress_not_over_target check (progress <= target)
);

create index goals_user_id_idx on public.goals (user_id);
create index goals_user_deadline_idx on public.goals (user_id, deadline);
create index goals_user_created_at_idx on public.goals (user_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.goals enable row level security;

create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy tasks_select_own
on public.tasks
for select
using (auth.uid() = user_id);

create policy tasks_insert_own
on public.tasks
for insert
with check (auth.uid() = user_id);

create policy tasks_update_own
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy tasks_delete_own
on public.tasks
for delete
using (auth.uid() = user_id);

create policy habits_select_own
on public.habits
for select
using (auth.uid() = user_id);

create policy habits_insert_own
on public.habits
for insert
with check (auth.uid() = user_id);

create policy habits_update_own
on public.habits
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy habits_delete_own
on public.habits
for delete
using (auth.uid() = user_id);

create policy habit_completions_select_own
on public.habit_completions
for select
using (
  exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
  )
);

create policy habit_completions_insert_own
on public.habit_completions
for insert
with check (
  exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
  )
);

create policy habit_completions_update_own
on public.habit_completions
for update
using (
  exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
  )
);

create policy habit_completions_delete_own
on public.habit_completions
for delete
using (
  exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
  )
);

create policy goals_select_own
on public.goals
for select
using (auth.uid() = user_id);

create policy goals_insert_own
on public.goals
for insert
with check (auth.uid() = user_id);

create policy goals_update_own
on public.goals
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy goals_delete_own
on public.goals
for delete
using (auth.uid() = user_id);
