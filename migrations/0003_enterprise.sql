PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  locale TEXT NOT NULL DEFAULT 'de-CH',
  week_start INTEGER NOT NULL DEFAULT 1,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  employee_number TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL DEFAULT 'active',
  department_id TEXT,
  manager_member_id TEXT,
  location TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, email),
  UNIQUE(organization_id, employee_number)
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost_center TEXT,
  parent_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  manager_member_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS work_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_weekly_minutes INTEGER NOT NULL DEFAULT 2700,
  min_daily_rest_minutes INTEGER NOT NULL DEFAULT 660,
  break_after_minutes INTEGER NOT NULL DEFAULT 420,
  break_minutes INTEGER NOT NULL DEFAULT 30,
  overtime_alert_minutes INTEGER NOT NULL DEFAULT 120,
  effective_from TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS time_periods (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TEXT,
  approved_at TEXT,
  locked_at TEXT,
  reopened_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, period_key)
);

CREATE TABLE IF NOT EXISTS time_approvals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES time_periods(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  approver_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(period_id, member_id)
);

CREATE TABLE IF NOT EXISTS planned_shifts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  shift_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 30,
  work_location TEXT NOT NULL DEFAULT 'Büro',
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enterprise_integrations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  config_json TEXT NOT NULL DEFAULT '{}',
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, integration_type)
);

CREATE TABLE IF NOT EXISTS payroll_exports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv',
  status TEXT NOT NULL DEFAULT 'prepared',
  row_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'Ferien',
  allocated_minutes INTEGER NOT NULL DEFAULT 0,
  used_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(member_id, year, leave_type)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_status ON organization_members(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_periods_org_status ON time_periods(organization_id, status, period_key);
CREATE INDEX IF NOT EXISTS idx_approvals_org_status ON time_approvals(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_org_date ON planned_shifts(organization_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_integrations_org_status ON enterprise_integrations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_exports_org_period ON payroll_exports(organization_id, period_key, created_at);
CREATE INDEX IF NOT EXISTS idx_leave_balances_member_year ON leave_balances(member_id, year);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_events(organization_id, created_at);
