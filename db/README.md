# Database setup for UDAAN Website

This directory contains SQL migrations that create the tables, indexes, triggers, and seed data the website expects when running against a Postgres/Supabase database.

## Files

| File | Purpose |
|------|---------|
| `setup.sql` | Creates all tables, indexes, constraints, and helper functions |
| `triggers.sql` | Adds triggers to auto-sync division tables and update timestamps |
| `seed.sql` | Inserts sample admin user and example data |
| `migration_inactive_status.sql` | Adds `is_inactive` and `inactive_since` fields to members table |

## Tables Overview

| Table | Purpose |
|-------|---------|
| `members` | Core team members with auth, roles, and divisions |
| `registrations` | Event registrations (Aeroprix, Hovermania, etc.) |
| `config` | App configuration (induction/registration toggles) |
| `applicants` | JoinCorps applications from potential members |
| `division_requests` | Requests from members to join additional divisions |
| `division_members` | General per-division membership (normalized) |
| `drone_members` | Legacy drone division table |
| `rc_plane_members` | Legacy RC plane division table |
| `rocketry_members` | Legacy rocketry division table |
| `creative_members` | Legacy creative/web-dev division table |
| `management_members` | Legacy management division table |
| `tasks` | Task assignments with priority, status, due dates |
| `announcements` | Team announcements (meetings, updates, deadlines) |
| `notifications` | Member notifications with announcement metadata |
| `activity_logs` | Activity tracking for analytics |
| `site_settings` | Optional JSON settings store |

## Member ID Format

- **Council members (3rd year)**: `UDAAN-001`, `UDAAN-002`, etc.
- **2nd year members**: `UDAAN-2001`, `UDAAN-2002`, etc.
- **3rd year (non-council)**: `UDAAN-3001`, `UDAAN-3002`, etc.
- **4th year members**: `UDAAN-4001`, `UDAAN-4002`, etc.

## How to Run

### Using Supabase SQL Editor

1. Open your Supabase project
2. Go to **SQL Editor** → **New query**
3. Run the files in order:
   - Paste `setup.sql` and run
   - Paste `triggers.sql` and run
   - Paste `seed.sql` and run

### Using psql (local/Postgres)

```bash
# Run all migrations in order
psql "$DATABASE_URL" -f db/setup.sql
psql "$DATABASE_URL" -f db/triggers.sql
psql "$DATABASE_URL" -f db/seed.sql
```

### Supabase Connection String

```bash
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" -f db/setup.sql
```

## Triggers

The `triggers.sql` file adds:

1. **Division sync trigger** — When a member's `division` field changes, the trigger automatically:
   - Removes them from all per-division tables
   - Re-adds them to the appropriate tables based on the comma-separated division list
   
2. **Updated timestamp trigger** — Automatically updates `updated_at` on `members` and `site_settings` tables

## Helper Functions

- `get_next_member_id()` — Generates the next council member ID (UDAAN-XXX format)

## Key Column Mappings

The code uses these column names:

| Code Uses | Description |
|-----------|-------------|
| `roll_no` | Student roll number (NOT `roll_number`) |
| `read` | Notification read status (NOT `is_read`) |
| `status` | pending/approved/rejected for members, applicants, requests |
| `clearance` | 5 = council, 3 = regular member |

## Notes

- The site reads some configuration from `public/config.json` for 1st/2nd year induction toggles
- The `members.member_id` is a `varchar` (e.g., `UDAAN-3001`) — not an integer
- All IDs use UUID format (`gen_random_uuid()`)
- The migration is idempotent (uses `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- The seed file creates an admin user with member_id `UDAAN-001` — **change the password immediately**!