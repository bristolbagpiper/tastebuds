# Supabase workflow

The source of truth for database changes is `supabase/migrations/`, not
`supabase/schema.sql`.

`schema.sql` exists only as a convenience mirror for manual use in the Supabase
SQL editor when you do not have the CLI installed yet.

## Current state

- `202604140001_baseline.sql` is the baseline migration for the project.
- It is intentionally idempotent because this project has already been changed
  manually in the Supabase dashboard.

## Recommended workflow

1. Install the Supabase CLI locally.
2. Link the repo to the Supabase project you are actually using.
3. Apply migrations from the repo instead of pasting random SQL blocks into the
   dashboard.
4. For every future schema change, create a new migration file.

## First-time setup once the CLI is installed

```bash
supabase login
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

If `supabase init` creates a `supabase/config.toml`, commit it. Do not invent a
  fake config by hand just to satisfy the folder shape.

## Creating the next migration

```bash
supabase migration new add_repeat_pair_history
```

Then edit the generated SQL file in `supabase/migrations/` and apply it with:

```bash
supabase db push
```

## If you are still using the dashboard manually

Run the latest migration file in `supabase/migrations/` or, if you need the
full current snapshot, use `supabase/schema.sql`.

Do not update `schema.sql` alone and call it done. That is how this project got
into schema drift in the first place.
