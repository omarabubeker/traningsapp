-- 0011 och 0012 skapade tabellerna utan GRANT, så inloggade användare nekades
-- (”permission denied”) trots RLS-policyerna. RLS begränsar fortfarande till egen rad.
grant select, insert, update, delete on public.goals to authenticated;
revoke all on public.goals from anon;

-- Klockkopplingen skrivs bara via säkra funktioner; appen behöver bara läsa sin rad.
grant select on public.watch_connections to authenticated;
revoke all on public.watch_connections from anon;
