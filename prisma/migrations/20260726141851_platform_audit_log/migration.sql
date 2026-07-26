create type "PlatformAction" as enum (
  'tenant_created', 'tenant_updated', 'tenant_suspended', 'tenant_reactivated',
  'tenant_archived', 'tenant_deleted', 'modules_changed', 'owner_created',
  'owner_password_reset', 'employee_role_edited', 'impersonation_started',
  'impersonation_write_unlocked', 'impersonation_ended', 'data_exported',
  'announcement_sent'
);

create table "PlatformAuditLog" (
  "id"        text not null,
  "actorId"   uuid not null,
  "action"    "PlatformAction" not null,
  "tenantId"  text,
  "targetId"  text,
  "metadata"  jsonb not null default '{}',
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "PlatformAuditLog_pkey" primary key ("id")
);

create index "PlatformAuditLog_tenantId_createdAt_idx" on "PlatformAuditLog"("tenantId", "createdAt");
create index "PlatformAuditLog_actorId_createdAt_idx" on "PlatformAuditLog"("actorId", "createdAt");

-- Journal réservé au prestataire : ni owner, ni staff, ni customer n'y accèdent.
alter table "PlatformAuditLog" enable row level security;

create policy "platform_audit_all_super_admin" on "PlatformAuditLog"
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
