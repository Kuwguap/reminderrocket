# Supabase Setup

## 1) Create a project
- Create a new Supabase project.
- Grab the project URL and service role key for `.env`.

## 2) Apply the schema
- Open the SQL editor in Supabase.
- Copy/paste `schema.sql` and run it.
- This creates `reminders`, `reminder_attempts`, and the `reminder-proofs` storage bucket.

## 3) Verify storage
- In Storage, confirm `reminder-proofs` exists and is private.
- No public policies are required because the API routes use the service role key.
