export interface Profile {
  id: string;
  full_name: string;
  role: "super_admin" | "admin";
  created_at: string;
  updated_at: string;
}

export type MemberStatus = "aktyvus" | "pasyvus" | "išstojęs";

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  join_date: string;
  status: MemberStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FeePeriod {
  id: string;
  year: number;
  name: string;
  amount_cents: number;
  due_date: string | null;
  fee_type: string;
  created_at: string;
}

export interface Payment {
  id: string;
  member_id: string;
  fee_period_id: string;
  amount_cents: number;
  paid_date: string;
  payment_method: "grynieji" | "pavedimas" | "kita";
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  member?: Member;
  fee_period?: FeePeriod;
}

export type DocumentCategory =
  | "protokolai"
  | "ataskaitos"
  | "istatai"
  | "sutartys"
  | "kita";

export interface Document {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  file_path: string;
  file_name: string;
  file_size: number | null;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_path: string | null;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  profile?: Profile;
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  unpaidCount: number;
  collectedThisYear: number;
  documentsCount: number;
  newsCount: number;
}

// Voting module types

export type MeetingType = "visuotinis" | "neeilinis" | "pakartotinis" | "valdybos";
export type MeetingStatus = "planuojamas" | "registracija" | "vyksta" | "baigtas" | "atšauktas";

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  ended_at: string | null;
  location: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  protocol_number: string | null;
  chairperson_name: string | null;
  secretary_name: string | null;
  agenda_approved: boolean;
  total_members_at_time: number;
  quorum_required: number;
  is_repeat: boolean;
  early_voting_start: string | null;
  early_voting_end: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type ResolutionStatus = "projektas" | "svarstomas" | "balsuojamas" | "patvirtintas" | "atmestas";

export interface Resolution {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  resolution_number: number;
  status: ResolutionStatus;
  is_procedural: boolean;
  procedural_type: "pirmininkas_sekretorius" | "darbotvarke" | null;
  requires_qualified_majority: boolean;
  discussion_text: string | null;
  decision_text: string | null;
  early_voting_open: boolean;
  result_for: number;
  result_against: number;
  result_abstain: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type VoteChoice = "uz" | "pries" | "susilaike";
export type VoteType = "fizinis" | "isankstinis" | "rastu";

export interface VoteBallot {
  id: string;
  resolution_id: string;
  member_id: string;
  vote: VoteChoice;
  vote_type: VoteType;
  voted_at: string;
  recorded_by: string | null;
  member?: Member;
}

export type AttendanceType = "fizinis" | "nuotolinis" | "rastu";

export interface MeetingAttendance {
  id: string;
  meeting_id: string;
  member_id: string;
  attendance_type: AttendanceType;
  registered_at: string;
  member?: Member;
}
