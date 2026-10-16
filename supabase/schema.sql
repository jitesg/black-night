-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: ai_model_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ai_model_cache" (
    "id" "text" DEFAULT 'gemini_model'::"text" NOT NULL,
    "model_name" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: ai_model_cache ai_model_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ai_model_cache_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ai_model_cache'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ai_model_cache"
    ADD CONSTRAINT "ai_model_cache_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ai_model_cache Allow service role full access on ai_model_cache; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow service role full access on ai_model_cache'
      AND n.nspname = 'public'
      AND c.relname = 'ai_model_cache'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow service role full access on ai_model_cache" ON "public"."ai_model_cache" TO "service_role" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ai_model_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_model_cache" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.


-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================


-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。

