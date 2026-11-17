# Usage metrics

The site counts anonymous events in the Supabase table `events`
(`supabase/migrations/0005_events.sql`). The list of names is `EVENT_NAMES` in
`src/lib/events.ts`; `/api/events` refuses any other name. There is no user id:
`tab` is a random id that lives in one browser tab.

| Event            | Sent when                                              | Sent from                          |
| ---------------- | ------------------------------------------------------ | ---------------------------------- |
| `visit`          | first page in a tab                                    | `src/scripts/session.ts`           |
| `first_check`    | first formula ever checked in this browser             | `src/scripts/exercise.ts`          |
| `first_solve`    | first exercise solved in this browser                  | `src/scripts/exercise.ts`          |
| `solve_3`        | third exercise solved (the sign-up line appears)       | `src/scripts/exercise.ts`          |
| `daily_done`     | today's daily exercise solved                          | `src/scripts/daily.ts`             |
| `mock_start`     | a mock assessment started                              | `src/scripts/assessment.ts`        |
| `mock_finish`    | a mock assessment finished                             | `src/scripts/assessment.ts`        |
| `paywall_seen`   | a PRO exercise or drill shown to a visitor without PRO | `src/scripts/locked-exercise.ts`   |
| `drill_start`    | a function drill session started                       | `src/scripts/drills.ts`            |
| `drill_finish`   | a function drill session reached its summary           | `src/scripts/drills.ts`            |
| `checkout_start` | Stripe Checkout opened                                 | `src/pages/api/stripe/checkout.ts` |
| `pro_active`     | a paid checkout saved PRO on the account               | `src/pages/api/stripe/webhook.ts`  |

`first_*` and `solve_3` are sent once per browser, `visit` once per tab.

## Queries

Run them in the Supabase SQL editor.

Funnel for the last 30 days, in tabs (one tab is roughly one visit):

```sql
select name, count(distinct coalesce(tab, id::text)) as tabs, count(*) as events
from events
where created_at > now() - interval '30 days'
group by name
order by array_position(array[
  'visit','first_check','first_solve','solve_3','paywall_seen',
  'checkout_start','pro_active','daily_done','drill_start','drill_finish',
  'mock_start','mock_finish'
], name);
```

Events per week, to see a change land:

```sql
select date_trunc('week', created_at) as week, name, count(*)
from events
group by 1, 2
order by 1 desc, 2;
```

Most visited pages where a paywall is seen:

```sql
select path, count(*) from events
where name = 'paywall_seen' and created_at > now() - interval '30 days'
group by path order by 2 desc limit 20;
```

Week-1 return needs a person, not a tab; for signed-in users read it from
`progress.updated_at` and `daily_solves.solved_at` instead.
