import { LoginResponse, ChatSession, ChatResponse, User, StudentReportPayload } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async startChatSession(identifier: { roll_number?: string; email?: string }): Promise<ChatSession> {
    return this.request<ChatSession>('/chat/session/start', {
      method: 'POST',
      body: JSON.stringify(identifier),
    });
  }

  async sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, message }),
    });
  }

  async getChatHistory(sessionId: string): Promise<{ messages: Array<{ role: string; content: string }>; count: number }> {
    return this.request(`/chat/session/${sessionId}/history`);
  }

  async endChatSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/chat/session/${sessionId}/end`, { method: 'POST' });
  }

  async getStudentReport(): Promise<StudentReportPayload> {
    return this.request<StudentReportPayload>('/report/student');
  }

  async downloadStudentReportPdf(): Promise<void> {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/report/student/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to download report' }));
      const d = err.detail;
      throw new Error(typeof d === 'string' ? d : 'Failed to download report');
    }

    const blob = await response.blob();
    const cd = response.headers.get('Content-Disposition');
    let filename = 'iba-academic-report.pdf';
    if (cd) {
      const m = /filename="([^"]+)"/i.exec(cd) || /filename=([^;\s]+)/i.exec(cd);
      if (m) filename = m[1].replace(/['"]/g, '');
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

export const api = new ApiService();
