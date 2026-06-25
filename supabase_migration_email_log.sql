-- ============================================================
-- Journal des emails de notification envoyés aux partenaires.
-- Permet à l'admin / au commercial de voir qui a été notifié, quand, et le statut.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partner_email_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_id           uuid,
  recipient_id    uuid,
  recipient_email text,
  kind            text,   -- list_1 | list_2 | relance | manual
  status          text,   -- sent | failed
  error           text,
  sent_by         uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_email_log_created ON public.partner_email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_email_log_ao ON public.partner_email_log (ao_id);
