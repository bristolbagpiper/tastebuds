update public.profiles
set intent = 'friendship'
where intent is distinct from 'friendship';

update public.events
set intent = 'friendship'
where intent is distinct from 'friendship';
