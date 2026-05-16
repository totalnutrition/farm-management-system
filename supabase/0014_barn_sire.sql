-- =====================================================================
-- 0014_barn_sire.sql — Phase 16a. Barns and sires are SUBJECTS
-- (extends the subject_type enum; never rewrites it). No new tables.
-- Run AFTER 0013. Idempotent. New enum values are not referenced
-- elsewhere in this migration → transaction-safe.
-- =====================================================================

alter type subject_type add value if not exists 'barn';
alter type subject_type add value if not exists 'sire';
