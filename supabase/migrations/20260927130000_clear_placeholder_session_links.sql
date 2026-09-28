-- The launch cohort's real Teams links will be added by Mark. A null URL is
-- rendered as "Link coming this week" and avoids exposing a dead demo link.
update public.sessions
set join_url = null
where join_url = 'https://meet.google.com';
