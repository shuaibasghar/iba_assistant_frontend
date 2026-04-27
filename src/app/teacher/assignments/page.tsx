'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { TeacherCourseOption } from '@/types';

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TeacherAssignmentUploadPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<TeacherCourseOption[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseCode, setCourseCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [opensLocal, setOpensLocal] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pdfScanning, setPdfScanning] = useState(false);
  const [pdfHint, setPdfHint] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'teacher')) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, user, router]);

  const loadCourses = useCallback(async () => {
    if (!user || user.role !== 'teacher') return;
    setLoadingCourses(true);
    try {
      const res = await api.getTeacherAssignmentCourses();
      setCourses(res.courses);
      if (res.courses.length) {
        setCourseCode((prev) => prev || res.courses[0].course_code);
      }
    } catch {
      setMessage({ type: 'err', text: 'Could not load your courses.' });
    } finally {
      setLoadingCourses(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'teacher') loadCourses();
  }, [user, loadCourses]);

  const applyPdfAnalysis = async (f: File) => {
    setPdfHint(null);
    setPdfScanning(true);
    try {
      const data = await api.analyzeTeacherAssignmentPdf(f);
      if (data.note) {
        setPdfHint(data.note);
      }
      const openL = isoToDatetimeLocal(data.opened_on);
      const closeL = isoToDatetimeLocal(data.closed_on);
      if (openL) setOpensLocal(openL);
      if (closeL) setDueLocal(closeL);
      if (data.title_hint) {
        setTitle((prev) => (prev.trim() ? prev : data.title_hint!));
      }
      if (data.marks_hint != null) {
        setTotalMarks(data.marks_hint);
      }
      if (!data.note && !data.opened_on && !data.closed_on) {
        setPdfHint('No opens/closes dates found in PDF text. Enter them manually.');
      }
    } catch {
      setPdfHint('Could not read PDF for auto-fill. Enter opens, due, and title manually.');
    } finally {
      setPdfScanning(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type === 'application/pdf' || f?.name?.toLowerCase().endsWith('.pdf')) {
      setFile(f);
      setMessage(null);
      void applyPdfAnalysis(f);
    } else {
      setMessage({ type: 'err', text: 'Please drop a PDF file.' });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !courseCode.trim() || !title.trim() || !dueLocal) {
      setMessage({ type: 'err', text: 'Course, title, due date, and PDF are required.' });
      return;
    }
    const due = new Date(dueLocal);
    if (Number.isNaN(due.getTime())) {
      setMessage({ type: 'err', text: 'Invalid due date.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const form = new FormData();
    form.append('file', file);
    form.append('course_code', courseCode.trim());
    form.append('title', title.trim());
    form.append('description', description.trim());
    form.append('due_date', due.toISOString());
    if (opensLocal.trim()) {
      const opens = new Date(opensLocal);
      if (!Number.isNaN(opens.getTime())) {
        form.append('opens_at', opens.toISOString());
      }
    }
    form.append('total_marks', String(totalMarks));
    try {
      const res = await api.uploadAssignmentPdf(form);
      setMessage({
        type: 'ok',
        text: `Created “${res.title}” for ${res.course_code}. ${res.students_notified} students can see it with a pending submission.`,
      });
      setTitle('');
      setDescription('');
      setOpensLocal('');
      setDueLocal('');
      setFile(null);
      setPdfHint(null);
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || user.role !== 'teacher') {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg px-3 py-6 sm:px-4 sm:py-10">
      <div className="max-w-xl mx-auto">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white sm:text-2xl">New assignment</h1>
            <p className="text-gray-400 text-sm mt-1">Upload a PDF brief for your class</p>
          </div>
          <Link
            href="/chat"
            className="shrink-0 text-sm text-indigo-300 hover:text-white transition-colors self-start sm:self-auto"
          >
            ← Chat
          </Link>
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-4 space-y-6 border border-white/10 sm:p-6">
          {message && (
            <div
              className={`px-4 py-3 rounded-xl text-sm ${
                message.type === 'ok'
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-300 border border-red-500/30'
              }`}
            >
              {message.text}
            </div>
          )}

          <div>
            <label className="text-sm text-gray-300 block mb-2">Course</label>
            <select
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              disabled={loadingCourses || !courses.length}
              className="input-modern w-full"
            >
              {loadingCourses ? (
                <option>Loading courses…</option>
              ) : (
                courses.map((c) => (
                  <option key={c.course_code} value={c.course_code}>
                    {c.course_code} — {c.course_name} (Sem {c.semester})
                  </option>
                ))
              )}
            </select>
            {!loadingCourses && !courses.length && (
              <p className="text-amber-400/90 text-xs mt-2">
                No assigned courses in the database for your account. Check teacher record
                (assigned_course_codes).
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-modern w-full"
              placeholder="e.g. Homework 3 — Classification"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Short description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-modern w-full min-h-[80px] resize-y"
              placeholder="One-line summary shown in lists"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-gray-300 block mb-2">Opens</label>
              <input
                type="datetime-local"
                value={opensLocal}
                onChange={(e) => setOpensLocal(e.target.value)}
                className="input-modern w-full"
                title="When students can start; from PDF if detected"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 block mb-2">Due (closes)</label>
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="input-modern w-full"
                title="Submission deadline; from PDF “closed on” / due if detected"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-2">Total marks</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={totalMarks}
              onChange={(e) => setTotalMarks(Number(e.target.value) || 100)}
              className="input-modern w-full"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Assignment PDF</label>
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed transition-all p-5 text-center cursor-pointer sm:p-8 ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-500/10'
                  : 'border-white/20 bg-white/5 hover:border-white/35'
              }`}
              onClick={() => document.getElementById('pdf-input')?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  document.getElementById('pdf-input')?.click();
                }
              }}
            >
              <input
                id="pdf-input"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setMessage(null);
                    void applyPdfAnalysis(f);
                  }
                }}
              />
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-rose-500/80 to-orange-500/80 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18h7a.75.75 0 0 0 0-1.5h-7a.75.75 0 0 0 0 1.5zm0-3h7a.75.75 0 0 0 0-1.5h-7a.75.75 0 0 0 0 1.5zm0-3h4a.75.75 0 0 0 0-1.5h-4a.75.75 0 0 0 0 1.5z" />
                </svg>
              </div>
              {pdfScanning && (
                <p className="text-indigo-300 text-sm mt-2">Reading PDF for dates…</p>
              )}
              {file ? (
                <p className="text-white font-medium">{file.name}</p>
              ) : (
                <>
                  <p className="text-white font-medium">Drop PDF here or click to browse</p>
                  <p className="text-gray-500 text-sm mt-2">Max 20 MB · Official brief only</p>
                </>
              )}
              {pdfHint && !pdfScanning && (
                <p className="text-amber-200/90 text-xs mt-3 max-w-md mx-auto">{pdfHint}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !courses.length}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Publish assignment
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
