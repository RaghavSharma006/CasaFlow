# CasaFlow automatic dispatch and shift sessions — Nov 16, 2026

Production: https://hotel-ops-pilot.vercel.app

* Login automatically starts the employee's shift (default 480 minutes).
* Managers configure per-employee shift duration (1–12 h), task capacity and verified skills.
* Supervisor: approval-only for cleaning inspections; no manual task allocation.
* New cleaning/maintenance/supply/damage jobs auto-assign to an on-shift qualified worker with spare capacity.
* Guest complaints route by department and category, including verified AC/plumbing skills.
* Every minute, a Supabase pg_cron job expires shifts and rebalances unfinished work.
* Shift expiry triggers client sign-out and new work assignment without losing the task history.
* Manual assignment UI and manual availability toggle removed; management emergency override RPC remains available.
* RLS and work RPCs require an active shift; sessions restored after expiry sign out instead of quietly restarting work.

QA: 73 frontend source tests; preview and production Vercel TypeScript/Vite builds; rolled-back database tests for automatic assignment, shift expiry handover and Supervisor denial.

Operational note: employees should sign out and back in once after this rollout so that their shift starts explicitly. Pending work is assigned when eligible staff signs in.
