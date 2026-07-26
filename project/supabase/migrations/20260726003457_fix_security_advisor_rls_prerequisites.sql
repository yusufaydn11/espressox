/*
# Security Advisor Fix - RLS Prerequisites

## Purpose
This migration prepares RLS policies so that RPC functions can safely switch
from SECURITY DEFINER to SECURITY INVOKER. When functions run as INVOKER,
they are subject to RLS — so the policies must permit the same INSERTs the
functions currently perform (notifications, qr_scans, stamp_cards, orders,
order_items, points_history, reward_redemptions). Several policy fixes are
also needed to eliminate Security Advisor warnings.

## Changes

### 1. notifications — customer-side INSERT policy
The existing "admin_insert_notifications" policy only allows is_admin() to
insert. RPC functions (create_order, redeem_reward, send_campaign) insert
notifications on behalf of users. Add "insert_own_notifications" so an
authenticated user can insert notifications where user_id = auth.uid().
Keep admin_insert_notifications for admin push notifications.

### 2. qr_scans — customer-side INSERT policy
The existing policies allow admin and franchise inserts. The qr_scan() RPC
inserts into qr_scans with the caller's user_id. Add "insert_own_scans"
so authenticated users can insert their own scan records.

### 3. campaigns — split public read policy
The existing "read_active_campaigns" policy is scoped to {anon, authenticated}
but references is_admin() in its USING clause. Supabase Security Advisor
warns about anon-accessible policies that call SECURITY DEFINER functions.
Split into:
  - "read_active_campaigns_public" (TO anon, authenticated) — no function calls
  - "read_active_campaigns_admin" (TO authenticated) — is_admin() can see all
This removes the Security Advisor warning while preserving behavior.

### 4. order_number_seq — grant USAGE to authenticated
The create_order() function calls nextval('order_number_seq'). As INVOKER,
the caller needs USAGE on the sequence.

### 5. stamp_cards — franchise INSERT policy
Add "franchise_insert_stamp_cards" so franchise users can insert stamp cards
for their own store (the trigger create_stamp_card_on_redeem is SECURITY
DEFINER and unaffected, but having the policy is good defense-in-depth).

## Security
- All new policies use auth.uid() ownership checks.
- No data is lost; only policies are added/modified.
- RLS remains enabled on all tables.
*/

-- ============================================================
-- 1. notifications: allow users to insert their own notifications
-- ============================================================
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. qr_scans: allow users to insert their own scan records
-- ============================================================
DROP POLICY IF EXISTS "insert_own_scans" ON qr_scans;
CREATE POLICY "insert_own_scans"
ON qr_scans FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. campaigns: split public read policy to avoid anon calling is_admin()
-- ============================================================
DROP POLICY IF EXISTS "read_active_campaigns" ON campaigns;
DROP POLICY IF EXISTS "read_active_campaigns_public" ON campaigns;
DROP POLICY IF EXISTS "read_active_campaigns_admin" ON campaigns;

-- Public (anon + authenticated): only active campaigns, no function calls
CREATE POLICY "read_active_campaigns_public"
ON campaigns FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- Admin: can see all campaigns regardless of status
CREATE POLICY "read_active_campaigns_admin"
ON campaigns FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================================
-- 4. order_number_seq: grant USAGE to authenticated
-- ============================================================
GRANT USAGE ON SEQUENCE order_number_seq TO authenticated;

-- ============================================================
-- 5. stamp_cards: franchise insert policy (defense-in-depth)
-- ============================================================
DROP POLICY IF EXISTS "franchise_insert_stamp_cards" ON stamp_cards;
CREATE POLICY "franchise_insert_stamp_cards"
ON stamp_cards FOR INSERT
TO authenticated
WITH CHECK (is_franchise() AND store_id = my_store_id());
