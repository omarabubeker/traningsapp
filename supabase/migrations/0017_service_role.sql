-- Projektet ger inte service_role behörighet automatiskt, så servern (admin-vyn och
-- /in/<nyckel>) nekades. Bara servern använder den här rollen.
grant select, insert, update, delete on public.members to service_role;
grant select on public.llm_usage to service_role;
