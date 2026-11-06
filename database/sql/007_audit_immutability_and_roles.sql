-- Migration 007: Audit Immutability & Database Privileges
-- Workspace: T:\My Projects\ECO-Flow\database

-- 1. Apply reject UPDATE/DELETE triggers to audit tables
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_reject_update_or_delete();

DROP TRIGGER IF EXISTS trg_login_audits_immutable ON public.login_audits;
CREATE TRIGGER trg_login_audits_immutable
BEFORE UPDATE OR DELETE ON public.login_audits
FOR EACH ROW
EXECUTE FUNCTION public.fn_reject_update_or_delete();

-- 2. Reject TRUNCATE Trigger Function
CREATE OR REPLACE FUNCTION public.fn_reject_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security violation: TRUNCATE operation is strictly prohibited on table %',
    TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
BEFORE TRUNCATE ON public.audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_reject_truncate();

DROP TRIGGER IF EXISTS trg_login_audits_no_truncate ON public.login_audits;
CREATE TRIGGER trg_login_audits_no_truncate
BEFORE TRUNCATE ON public.login_audits
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_reject_truncate();

DROP TRIGGER IF EXISTS trg_product_versions_no_truncate ON public.product_versions;
CREATE TRIGGER trg_product_versions_no_truncate
BEFORE TRUNCATE ON public.product_versions
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_reject_truncate();

DROP TRIGGER IF EXISTS trg_bom_versions_no_truncate ON public.bom_versions;
CREATE TRIGGER trg_bom_versions_no_truncate
BEFORE TRUNCATE ON public.bom_versions
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_reject_truncate();

-- 3. Enable Row-Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_revision_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Audit Table Privilege Restrictions (Revoke destructive DML from public and authenticated)
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON public.login_audits FROM PUBLIC;
