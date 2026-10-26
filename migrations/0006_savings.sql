-- income created by a savings withdrawal ("add back to income"); removed automatically if the withdrawal is deleted
alter table income_lines add column source_transaction_id uuid references transactions(id) on delete cascade;
