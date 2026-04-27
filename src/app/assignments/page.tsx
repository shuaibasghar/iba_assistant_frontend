'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { StudentAssignmentListItem } from '@/types';

export default function StudentAssignmentsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<StudentAssignmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dlId, setDlId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'student')) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (user?.role !== 'student') return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await api.getMyAssignmentsList();
        setRows(res.assignments);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const download = async (id: string) => {
    setDlId(id);
    try {
      await api.downloadAssignmentPdf(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDlId(null);
    }
  };

  if (authLoading || !user || user.role !== 'student') {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg px-3 py-6 sm:px-4 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white sm:text-2xl">My assignments</h1>
            <p className="text-gray-400 text-sm mt-1">Includes PDF briefs from your instructors</p>
          </div>
          <Link
            href="/chat"
            className="shrink-0 text-sm text-indigo-300 hover:text-white transition-colors self-start sm:self-auto"
          >
            ← Chat
          </Link>
        </div>

        {loading && <p className="text-gray-400">Loading…</p>}
        {err && (
          <div className="glass border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-4">{err}</div>
        )}

        {!loading && !rows.length && (
          <p className="text-gray-500">No assignments for your current semester courses.</p>
        )}

        <ul className="space-y-3">
          {rows.map((a) => (
            <li
              key={a.assignment_id}
              className="glass rounded-xl p-4 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <p className="text-white font-medium">{a.title}</p>
                <p className="text-gray-400 text-sm">
                  {a.course_code}
                  {a.course_name ? ` · ${a.course_name}` : ''}
                  {a.due_date ? ` · Due ${new Date(a.due_date).toLocaleString()}` : ''}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Status: <span className="text-gray-300">{a.submission_status}</span>
                  {a.source === 'pdf_upload' ? (
                    <span className="ml-2 text-indigo-300">· PDF brief</span>
                  ) : null}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.has_pdf_attachment ? (
                  <button
                    type="button"
                    onClick={() => download(a.assignment_id)}
                    disabled={dlId === a.assignment_id}
                    className="btn-secondary !py-2 !px-3 flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18h7a.75.75 0 0 0 0-1.5h-7a.75.75 0 0 0 0 1.5z" />
                    </svg>
                    {dlId === a.assignment_id ? '…' : 'PDF'}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
