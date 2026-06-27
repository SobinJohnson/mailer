// ─── Database Entity Types ───────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  linkedin_url: string | null;
  notes: string | null;
  tags: string[];
  status: 'active' | 'inactive' | 'do_not_contact';
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  designation: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  linkedin_url: string | null;
  is_general_mailbox: boolean;
  verification_status?: 'verified' | 'risky' | 'failed' | 'unverified';
  is_active?: boolean;
  created_at: string;
  // Joined fields
  company?: Company;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  category: 'intro' | 'follow_up' | 'product' | 'event' | null;
  attachments?: any[];
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  smtp_config_id: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  send_gap_minutes: number;
  gap_jitter_pct: number;
  scheduled_at: string | null;
  start_date: string | null;
  end_date: string | null;
  send_time: string | null;
  active_days: string[];
  followups: Array<{ template_id: string; gap_days: number }>;
  attachments: CampaignAttachment[];
  created_at: string;
  updated_at: string;
  // Deprecated
  followup_template_id: string | null;
  followup_gap_days: number | null;
  // Joined fields
  email_template?: EmailTemplate;
  smtp_config?: SmtpConfig;
}

export interface CampaignAttachment {
  filename: string;
  storage_path?: string;
  storagePath?: string;
  path?: string;
  size?: number;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  company_id: string;
  status: 'pending' | 'queued' | 'sent' | 'failed' | 'skipped' | 'replied';
  scheduled_send: string | null;
  sent_at: string | null;
  error_message: string | null;
  email_snapshot: EmailSnapshot | null;
  message_id: string | null;
  parent_message_id: string | null;
  replied_at: string | null;
  reply_read?: boolean;
  step: number;
  created_at: string;
  // Joined fields
  contact?: Contact;
  company?: Company;
  campaign?: Campaign;
}

export interface EmailSnapshot {
  subject: string;
  body_html: string;
  body_text: string | null;
  message_id?: string;
}

export interface SmtpConfig {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string; // Never returned to client after save
  from_email: string;
  from_name: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean | null;
  imap_username: string | null;
  imap_password?: string | null;
  is_default: boolean;
  signature_html: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

export interface SendLog {
  id: string;
  recipient_id: string;
  campaign_id: string;
  contact_email: string;
  status: 'sent' | 'failed' | 'bounced';
  smtp_response: string | null;
  sent_at: string;
}

// ─── API Types ───────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CompanyFilters {
  search?: string;
  status?: Company['status'];
  tags?: string[];
  industry?: string;
  page?: number;
  pageSize?: number;
}

export interface ContactFilters {
  search?: string;
  company_id?: string;
  page?: number;
  pageSize?: number;
}

// ─── UI Types ────────────────────────────────────────────────────────────────

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string | number;
}

export interface DashboardStats {
  totalCompanies: number;
  totalContacts: number;
  activeCampaigns: number;
  todaySent: number;
  todayFailed: number;
  todayPending: number;
  queuedCount: number;
  nextSendAt: string | null;
}
