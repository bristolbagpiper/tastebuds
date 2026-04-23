grant delete on public.notifications to authenticated;

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
on public.notifications
for delete
using (auth.uid() = user_id);
