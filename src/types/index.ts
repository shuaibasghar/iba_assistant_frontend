export interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin' | 'superadmin';
  department: string;
  roll_number?: string;
  semester?: number;
  batch?: string;
  cgpa?: number;
  employee_id?: string;
  designation?: string;
  /** Teacher: assigned course codes from API */
  courses?: string[];
}

export interface TeacherCourseOption {
  course_code: string;
  course_name?: string;
  semester?: number;
  credit_hours?: number;
}

export interface StudentAssignmentListItem {
  assignment_id: string;
  title?: string;
  course_code?: string;
  course_name?: string;
  due_date?: string | null;
  total_marks?: number;
  description?: string;
  has_pdf_attachment?: boolean;
  submission_status?: string;
  source?: string;
}

export interface AssignmentPdfAnalyzeResponse {
  opened_on: string | null;
  closed_on: string | null;
  title_hint: string | null;
  marks_hint: number | null;
  raw_text_preview?: string;
  note?: string | null;
}

export interface CreateAssignmentPdfResponse {
  assignment_id: string;
  course_code: string;
  title: string;
  due_date: string;
  opens_at: string;
  students_notified: number;
  attachment_stored_name: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  role: string;
  user: User;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
}

export interface ChatSession {
  session_id: string;
  student_name: string;
  roll_number: string;
  email: string;
  semester: number;
  department: string;
  user_role: string;
}

export interface ChatResponse {
  session_id: string;
  message: string;
  intent: string;
  student_name: string;
  timestamp: string;
  processing_time_ms: number;
}

export interface ApiError {
  detail: string;
}

export interface StudentReportTable {
  headers: string[];
  rows: Array<Array<string | number | boolean | null>>;
}

export interface StudentReportSection {
  id: string;
  title: string;
  /** Plain lines of text before the table (if any). */
  paragraphs?: string[];
  /** Structured grid for the modal; null when this section has no data table. */
  table?: StudentReportTable | null;
  /** Legacy HTML fallback if ``paragraphs``/``table`` are absent. */
  html: string;
}

export interface ReportBarSeries {
  dataKey: string;
  name: string;
  fill: string;
}

export interface StudentReportChart {
  id: string;
  /** Matches ``sections[].id`` so the chart renders under that section. */
  section_id?: string;
  title: string;
  type: 'bar' | 'pie';
  data: Array<Record<string, string | number>>;
  xAxisKey?: string;
  bars?: ReportBarSeries[];
  nameKey?: string;
  valueKey?: string;
  colors?: string[];
}

export interface StudentReportPayload {
  student: {
    full_name?: string;
    roll_number?: string;
    department?: string;
    batch?: string;
    cgpa?: number;
    semester?: number;
  };
  generated_at: string;
  sections: StudentReportSection[];
  charts: StudentReportChart[];
  full_html: string;
}
