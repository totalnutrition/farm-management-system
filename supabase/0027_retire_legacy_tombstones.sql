-- =====================================================================
-- 0027_retire_legacy_tombstones.sql — Cleanup. After 0023 unified the
-- drug catalogue into Supply items, the old `drug` subjects were left
-- in place "so the change is reversible". The migration has shipped
-- and is proven; the orphans now only add noise. Likewise 0022 parked
-- the old per-sire straw count as `legacy_straws` once semen moved
-- into Supply.
--
-- This removes both, defensively:
--   * `drug` subjects are deleted ONLY when no event references them
--     (0023's premise) — any referenced row is kept untouched.
--   * the `legacy_straws` attr key is stripped from every subject.
-- The `drug` enum value on subject_type is intentionally NOT dropped
-- (Postgres can't remove enum values, and nothing reads it). Set-
-- based and idempotent. Run AFTER 0026. Safe to re-run.
-- =====================================================================

delete from public.subjects d
where d.subject_type = 'drug'
  and not exists (
    select 1 from public.events e where e.subject_id = d.id
  );

update public.subjects
set attrs = attrs - 'legacy_straws'
where attrs ? 'legacy_straws';
