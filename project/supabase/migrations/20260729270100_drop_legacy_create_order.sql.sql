-- Hotfix: remove legacy create_order signature (5 params) to avoid RPC ambiguity

DROP FUNCTION IF EXISTS public.create_order(jsonb, numeric, text, text, text);
