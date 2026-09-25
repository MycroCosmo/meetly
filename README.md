# Meetly

Meetly is a mobile-first group scheduling service that combines **time availability, place voting, and expense splitting** in one temporary meeting room.

The project was designed around a simple constraint: participants should be able to join and coordinate without creating a permanent account.

## Problems addressed

A group normally has to solve three separate questions:

1. When can everyone meet?
2. Where should the group meet?
3. How should shared expenses be divided?

Meetly keeps those decisions inside one room and allows anonymous participation through a participant token.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | Nuxt 3, Vue 3, TypeScript |
| Database | Supabase PostgreSQL |
| Authorization | PostgreSQL Row Level Security |
| Server-side jobs | Supabase Edge Functions |
| Deployment | Vercel + Supabase |

## Main features

### Availability overlap

Participants submit available time ranges.

Availability is normalized into 30-minute slots so overlap can be aggregated and the strongest candidate periods can be shown consistently.

### Place voting

Participants can add candidate places and vote on them. The room owner can finalize the selected location after reviewing the result.

### Expense splitting

Expense items support:

- equal split;
- custom per-participant amounts;
- validation that custom shares match the total amount.

### Anonymous participation

The core flow does not require account creation.

A participant token identifies the participant inside the room, while database access is constrained through RLS policies.

### Temporary-room lifecycle

Meeting rooms are temporary data rather than permanent social profiles.

Expired rooms are cleaned by a scheduled Edge Function. Cleanup is processed in bounded batches so one failure does not need to stop the whole run.

## Data and authorization model

The backend is intentionally small. Most persistence and authorization behavior is expressed in PostgreSQL/Supabase.

Main concepts include:

- rooms;
- participants;
- availability blocks;
- place candidates and votes;
- expense items and shares.

RLS is used so a participant can read the room data needed for collaboration while writes remain constrained to the appropriate participant/context.

## Project structure

```text
meetly/
├── components/
├── composables/
├── pages/
├── supabase/
│   ├── migrations/
│   └── functions/
└── ARCHITECTURE.md
```

## Local setup

```bash
npm install
npm run dev
```

Create a local `.env` with the Supabase project URL and anonymous key.

Database schema and RLS policies are stored under `supabase/migrations`.

## What this project demonstrates

- modeling a short-lived collaboration workflow;
- authorization at the data layer with RLS;
- anonymous-user state without mandatory signup;
- deterministic time-slot aggregation;
- cleanup of temporary data through scheduled jobs.
