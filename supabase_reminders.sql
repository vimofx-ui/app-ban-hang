-- Create reminders table
create table if not exists reminders (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  message text,
  type text check (type in ('shift_elapsed', 'scheduled')), -- 'shift_elapsed' (after X mins of shift) or 'scheduled' (specific time of day)
  
  -- For 'shift_elapsed'
  elapsed_minutes integer, -- Trigger X minutes after clock-in
  
  -- For 'scheduled'
  schedule_time time, -- Daily trigger time (HH:MM:SS)
  days_of_week integer[], -- 0=Sun, 1=Mon, ..., 6=Sat. Null means everyday.
  
  is_active boolean default true,
  repeat_interval integer, -- Minutes to repeat the alert after first trigger
  max_repeats integer default 1, -- How many times to repeat (default 1 = once only, no repeat)
  
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- RLS Policies (Optional but recommended)
alter table reminders enable row level security;

create policy "Enable read access for authenticated users" on reminders
  for select using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users" on reminders
  for insert with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users" on reminders
  for update using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users" on reminders
  for delete using (true); -- TEMPORARY: Allow all deletes to debug
