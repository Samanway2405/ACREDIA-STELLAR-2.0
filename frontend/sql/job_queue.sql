-- =====================================================================
-- ACREDIA-STELLAR — JOB QUEUE SCHEMA (IDEMPOTENT)
-- Issue #167: Background worker / job queue
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.jobs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT NOT NULL,
    payload          JSONB NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts         INTEGER NOT NULL DEFAULT 0,
    max_attempts     INTEGER NOT NULL DEFAULT 3,
    run_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    locked_at        TIMESTAMP WITH TIME ZONE,
    locked_by        TEXT,
    error_log        TEXT,
    idempotency_key  TEXT UNIQUE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.jobs IS
    'Postgres-backed job queue for background asynchronous tasks (re-pinning, indexing, notifications).';

CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at 
    ON public.jobs (status, run_at) 
    WHERE status = 'pending';

-- Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;

-- Only Admins (via service_role or admin check) can view/manage jobs directly.
-- The worker process will use the service_role key to bypass RLS policies.
DROP POLICY IF EXISTS "Admin can view jobs" ON public.jobs;
CREATE POLICY "Admin can view jobs"
    ON public.jobs FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage jobs" ON public.jobs;
CREATE POLICY "Admin can manage jobs"
    ON public.jobs FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- Function: next_job(p_worker_id text)
-- Picks and locks the next pending job that is ready to run.
-- Uses FOR UPDATE SKIP LOCKED to prevent multiple workers from picking
-- the same job concurrently.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_job(p_worker_id text)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id uuid;
BEGIN
    SELECT id INTO v_job_id
    FROM public.jobs
    WHERE status = 'pending' AND run_at <= NOW()
    ORDER BY run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
        UPDATE public.jobs
        SET status = 'processing',
            locked_at = NOW(),
            locked_by = p_worker_id,
            attempts = attempts + 1,
            updated_at = NOW()
        WHERE id = v_job_id;

        RETURN QUERY SELECT * FROM public.jobs WHERE id = v_job_id;
    END IF;
END;
$$;

-- next_job is NOT accessible to public / authenticated users.
REVOKE ALL ON FUNCTION public.next_job(text) FROM PUBLIC;

COMMIT;
