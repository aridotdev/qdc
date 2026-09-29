CREATE TRIGGER `audit_logs_append_only_update`
BEFORE UPDATE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_logs_append_only_delete`
BEFORE DELETE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
