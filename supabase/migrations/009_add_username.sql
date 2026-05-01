-- ============================================================================
-- Migration 009: Add username column + public lookup function
-- ============================================================================
-- Adds username to user_profiles for login-by-username support.
-- Creates a SECURITY DEFINER function so unauthenticated users can
-- resolve a username → email before signing in.
-- ============================================================================

-- ── 1. Add username column ─────────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_username
  ON user_profiles(username);

-- ── 2. Public RPC to look up email by username (bypasses RLS) ──────────────

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM user_profiles WHERE username = p_username LIMIT 1;
$$;
