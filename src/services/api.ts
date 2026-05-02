import {
    LoginResponse,
    ChatSession,
    ChatResponse,
    User,
    StudentReportPayload,
    TeacherCourseOption,
    StudentAssignmentListItem,
    CreateAssignmentPdfResponse,
    AssignmentPdfAnalyzeResponse,
} from "@/types";
import { portalChatSessionStorageKey } from "@/lib/portalChatSession";

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://137.184.70.56";

/** Paths where 401 means invalid credentials, not "session expired". */
const AUTH_401_NO_LOGOUT = new Set(["/api/auth/login", "/api/auth/login/form"]);

/**
 * Clear stored auth and send the user to login (session expired / revoked token).
 * Skips redirect if already on the login page.
 */
export function clearSessionAndRedirectToLogin(): void {
    if (typeof window === "undefined") return;
    try {
        const raw = localStorage.getItem("user");
        if (raw) {
            const u = JSON.parse(raw) as { user_id?: string };
            if (u?.user_id) {
                localStorage.removeItem(portalChatSessionStorageKey(u.user_id));
            }
        }
    } catch {
        /* ignore */
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    if (window.location.pathname !== "/login") {
        window.location.assign("/login?session=expired");
    }
}

function shouldLogoutOn401(endpoint: string, hadBearer: boolean): boolean {
    if (!hadBearer) return false;
    if (AUTH_401_NO_LOGOUT.has(endpoint)) return false;
    return true;
}

class ApiService {
    private getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem("access_token");
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
    ): Promise<T> {
        const token = this.getToken();

        const headers: HeadersInit = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (token) {
            (headers as Record<string, string>)["Authorization"] =
                `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            if (
                response.status === 401 &&
                shouldLogoutOn401(endpoint, Boolean(token))
            ) {
                clearSessionAndRedirectToLogin();
            }
            const error = await response
                .json()
                .catch(() => ({ detail: "An error occurred" }));
            const detail = error.detail;
            const msg =
                typeof detail === "string"
                    ? detail
                    : Array.isArray(detail)
                      ? detail
                            .map((d: { msg?: string }) => d.msg)
                            .filter(Boolean)
                            .join(", ")
                      : "Request failed";
            throw new Error(msg || "Request failed");
        }

        return response.json();
    }

    async login(email: string, password: string): Promise<LoginResponse> {
        return this.request<LoginResponse>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    }

    async logout(): Promise<void> {
        try {
            await this.request("/api/auth/logout", { method: "POST" });
        } finally {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("user");
        }
    }

    async getMe(): Promise<User> {
        return this.request<User>("/api/auth/me");
    }

    async refreshToken(refreshToken: string): Promise<LoginResponse> {
        return this.request<LoginResponse>("/api/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
    }

    async startChatSession(identifier: {
        roll_number?: string;
        email?: string;
        student_id?: string;
        user_role?: string;
    }): Promise<ChatSession> {
        return this.request<ChatSession>("/api/chat/session/start", {
            method: "POST",
            body: JSON.stringify(identifier),
        });
    }

    async sendMessage(
        sessionId: string,
        message: string,
    ): Promise<ChatResponse> {
        return this.request<ChatResponse>("/api/chat/message", {
            method: "POST",
            body: JSON.stringify({ session_id: sessionId, message }),
        });
    }

    async getChatHistory(sessionId: string): Promise<{
        messages: Array<{ role: string; content: string }>;
        count: number;
    }> {
        return this.request(`/api/chat/session/${sessionId}/history`);
    }

    async endChatSession(
        sessionId: string,
    ): Promise<{ success: boolean; message: string }> {
        return this.request(`/api/chat/session/${sessionId}/end`, {
            method: "POST",
        });
    }

    async getStudentReport(): Promise<StudentReportPayload> {
        return this.request<StudentReportPayload>("/api/report/student");
    }

    async getTeacherAssignmentCourses(): Promise<{
        courses: TeacherCourseOption[];
    }> {
        return this.request("/api/assignments/teacher/courses");
    }

    /** Per-student submission rows for assignments this teacher created (optional assignment filter). */
    async getTeacherSubmissions(assignmentId?: string): Promise<unknown> {
        const q = assignmentId
            ? `?assignment_id=${encodeURIComponent(assignmentId)}`
            : "";
        return this.request(`/api/assignments/teacher/submissions${q}`);
    }

    async gradeTeacherSubmission(payload: {
        submission_id?: string;
        assignment_id?: string;
        student_roll?: string;
        marks_obtained: number;
        feedback?: string;
    }): Promise<unknown> {
        return this.request("/api/assignments/teacher/grade-submission", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async analyzeTeacherAssignmentPdf(
        file: File,
    ): Promise<AssignmentPdfAnalyzeResponse> {
        const token = this.getToken();
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(
            `${API_BASE_URL}/api/assignments/teacher/pdf/analyze`,
            {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            },
        );
        if (response.status === 401 && token) {
            clearSessionAndRedirectToLogin();
        }
        if (!response.ok) {
            const err = await response
                .json()
                .catch(() => ({ detail: "Analyze failed" }));
            const d = err.detail;
            throw new Error(typeof d === "string" ? d : "Analyze failed");
        }
        return response.json();
    }

    async uploadAssignmentPdf(
        formData: FormData,
    ): Promise<CreateAssignmentPdfResponse> {
        const token = this.getToken();
        const response = await fetch(
            `${API_BASE_URL}/api/assignments/teacher/pdf`,
            {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            },
        );
        if (response.status === 401 && token) {
            clearSessionAndRedirectToLogin();
        }
        if (!response.ok) {
            const err = await response
                .json()
                .catch(() => ({ detail: "Upload failed" }));
            const d = err.detail;
            throw new Error(typeof d === "string" ? d : "Upload failed");
        }
        return response.json();
    }

    async uploadChatFile(
        sessionId: string,
        file: File,
    ): Promise<{ success: boolean; message: string; data: any }> {
        const token = this.getToken();
        const formData = new FormData();
        formData.append("session_id", sessionId);
        formData.append("file", file);

        const response = await fetch(`${API_BASE_URL}/api/chat/upload_file`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });
        if (response.status === 401 && token) {
            clearSessionAndRedirectToLogin();
        }
        if (!response.ok) {
            const err = await response
                .json()
                .catch(() => ({ detail: "Upload failed" }));
            const d = err.detail;
            throw new Error(typeof d === "string" ? d : "Upload failed");
        }
        return response.json();
    }

    async getMyAssignmentsList(): Promise<{
        assignments: StudentAssignmentListItem[];
    }> {
        return this.request("/api/assignments/student/mine");
    }

    async downloadAssignmentPdf(assignmentId: string): Promise<void> {
        const token = this.getToken();
        const response = await fetch(
            `${API_BASE_URL}/api/assignments/${assignmentId}/attachment`,
            {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
        );
        if (response.status === 401 && token) {
            clearSessionAndRedirectToLogin();
        }
        if (!response.ok) {
            const err = await response
                .json()
                .catch(() => ({ detail: "Download failed" }));
            const d = err.detail;
            throw new Error(typeof d === "string" ? d : "Download failed");
        }
        const blob = await response.blob();
        const cd = response.headers.get("Content-Disposition");
        let filename = "assignment-brief.pdf";
        if (cd) {
            const m =
                /filename="([^"]+)"/i.exec(cd) ||
                /filename=([^;\s]+)/i.exec(cd);
            if (m) filename = m[1].replace(/['"]/g, "");
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async downloadStudentReportPdf(): Promise<void> {
        const token = this.getToken();
        const response = await fetch(`${API_BASE_URL}/api/report/student/pdf`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.status === 401 && token) {
            clearSessionAndRedirectToLogin();
        }
        if (!response.ok) {
            const err = await response
                .json()
                .catch(() => ({ detail: "Failed to download report" }));
            const d = err.detail;
            throw new Error(
                typeof d === "string" ? d : "Failed to download report",
            );
        }

        const blob = await response.blob();
        const cd = response.headers.get("Content-Disposition");
        let filename = "iba-academic-report.pdf";
        if (cd) {
            const m =
                /filename="([^"]+)"/i.exec(cd) ||
                /filename=([^;\s]+)/i.exec(cd);
            if (m) filename = m[1].replace(/['"]/g, "");
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
}

export const api = new ApiService();
