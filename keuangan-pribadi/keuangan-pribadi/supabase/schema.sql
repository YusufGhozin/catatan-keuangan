-- Ruang Keuangan
-- Jalankan seluruh file ini sekali di Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_date date not null,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(16, 2) not null check (amount > 0),
  category text not null check (char_length(trim(category)) between 1 and 60),
  payment_method text not null default 'Tunai',
  account text null check (account is null or char_length(account) <= 80),
  description text null check (description is null or char_length(description) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);

create index if not exists transactions_user_kind_idx
  on public.transactions (user_id, kind);

alter table public.transactions enable row level security;

-- Hak akses tabel dibuat minimum: pengunjung anonim tidak dapat mengaksesnya.
-- Pengguna yang sudah login hanya mendapat operasi yang diperlukan aplikasi;
-- RLS di bawah tetap membatasi baris berdasarkan user_id.
revoke all on table public.transactions from anon, authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;

-- Pengguna hanya dapat membaca transaksi miliknya sendiri.
drop policy if exists "Users can read their own transactions" on public.transactions;
create policy "Users can read their own transactions"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

-- Pengguna hanya dapat menambahkan transaksi untuk akun miliknya sendiri.
drop policy if exists "Users can insert their own transactions" on public.transactions;
create policy "Users can insert their own transactions"
  on public.transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Pengguna hanya dapat mengubah transaksi miliknya sendiri.
drop policy if exists "Users can update their own transactions" on public.transactions;
create policy "Users can update their own transactions"
  on public.transactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Pengguna hanya dapat menghapus transaksi miliknya sendiri.
drop policy if exists "Users can delete their own transactions" on public.transactions;
create policy "Users can delete their own transactions"
  on public.transactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- Otomatis memperbarui kolom updated_at ketika transaksi diedit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();
