'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '@/services/api';
import type { StudentReportChart, StudentReportPayload, StudentReportSection, StudentReportTable } from '@/types';

const CHART_FALLBACK_COLORS = ['#818cf8', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#22d3ee'];

function formatCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function SectionParagraphs({ section }: { section: StudentReportSection }) {
  const lines = section.paragraphs ?? [];
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (section.id === 'overview' && i === 0) {
          return (
            <p key={i} className="text-base font-semibold text-white leading-snug">
              {line}
            </p>
          );
        }
        if (section.id === 'overview' && i === 1) {
          return (
            <p key={i} className="text-sm text-gray-400 leading-relaxed">
              {line}
            </p>
          );
        }
        if (section.id === 'fees' && i > 0) {
          return (
            <p key={i} className="text-sm text-amber-200/90 leading-relaxed">
              {line}
            </p>
          );
        }
        if (section.id === 'exams' && i > 0) {
          return (
            <p
              key={i}
              className="text-sm text-white/90 leading-relaxed rounded-lg bg-indigo-500/15 border border-indigo-400/20 px-3 py-2.5"
            >
              {line}
            </p>
          );
        }
        return (
          <p key={i} className="text-sm text-gray-300/95 leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function DataTable({ table }: { table: StudentReportTable }) {
  return (
    <div className="mt-4 rounded-xl border border-white/12 overflow-hidden bg-black/25 shadow-inner">
      <div className="overflow-x-auto max-h-[min(480px,55vh)] overflow-y-auto overscroll-contain">
        <table className="w-full min-w-max text-left text-sm border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gradient-to-b from-indigo-600/95 to-indigo-700/90 backdrop-blur-md border-b border-white/15">
              {table.headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3 py-3 font-semibold text-white text-xs uppercase tracking-wide border-r border-white/10 last:border-r-0 align-bottom whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-200">
            {table.rows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-white/[0.07] transition-colors hover:bg-indigo-500/[0.07] ${
                  ri % 2 === 0 ? 'bg-white/[0.03]' : 'bg-transparent'
                }`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2.5 align-top text-[13px] leading-snug border-r border-white/[0.05] last:border-r-0 break-words"
                  >
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartWidget({ chart }: { chart: StudentReportChart }) {
  const tooltipStyle = {
    backgroundColor: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#e2e8f0',
  };

  if (chart.type === 'pie' && chart.nameKey && chart.valueKey) {
    return (
      <div className="mt-4 glass-light rounded-xl p-4 border border-white/10">
        <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">{chart.title}</h4>
        <div className="h-52 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chart.data}
                dataKey={chart.valueKey}
                nameKey={chart.nameKey}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={68}
                paddingAngle={2}
              >
                {chart.data.map((_, i) => (
                  <Cell
                    key={`${chart.id}-cell-${i}`}
                    fill={
                      chart.colors?.[i % chart.colors.length] ??
                      CHART_FALLBACK_COLORS[i % CHART_FALLBACK_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (chart.type === 'bar' && chart.xAxisKey && chart.bars?.length) {
    return (
      <div className="mt-4 glass-light rounded-xl p-4 border border-white/10">
        <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">{chart.title}</h4>
        <div className="h-52 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey={chart.xAxisKey}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              {chart.bars.map((b) => (
                <Bar
                  key={b.dataKey}
                  dataKey={b.dataKey}
                  name={b.name}
                  fill={b.fill}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}

export function StudentReportModal({
  open,
  onClose,
  report,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  report: StudentReportPayload | null;
  loading: boolean;
  error: string | null;
}) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const chartsBySection = useMemo(() => {
    const m = new Map<string, StudentReportChart>();
    if (!report?.charts) return m;
    for (const c of report.charts) {
      const sid = c.section_id;
      if (sid) m.set(sid, c);
    }
    return m;
  }, [report]);

  useEffect(() => {
    if (!open) setPdfLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      await api.downloadStudentReportPdf();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Could not download PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm border-0 cursor-default"
        aria-label="Close report"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        className="relative z-10 w-full max-w-4xl max-h-[min(92vh,100dvh)] overflow-hidden flex flex-col glass rounded-2xl border border-white/15 shadow-2xl slide-up"
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <h2 id="report-dialog-title" className="text-lg font-semibold text-white tracking-tight">
              Academic report
            </h2>
            {report && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                {report.student.full_name}
                {report.student.roll_number ? ` · ${report.student.roll_number}` : ''}
                <span className="text-gray-500">
                  {' '}
                  · {new Date(report.generated_at).toLocaleString()}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin opacity-80" />
              <p className="text-gray-400 text-sm">Loading report…</p>
            </div>
          )}
          {error && !loading && (
            <p className="text-red-400 text-center text-sm py-12 px-4">{error}</p>
          )}
          {report && !loading && (
            <div className="space-y-6">
              {report.sections.map((s) => (
                <div
                  key={s.id}
                  className="report-section-card glass-light rounded-xl p-5 sm:p-6 border border-white/10"
                >
                  <h3 className="text-base font-semibold text-white mb-4 tracking-tight border-b border-white/10 pb-2">
                    {s.title}
                  </h3>
                  {(s.paragraphs?.length ?? 0) > 0 ? (
                    <SectionParagraphs section={s} />
                  ) : (
                    <div
                      className="report-modal-prose text-sm text-gray-300"
                      dangerouslySetInnerHTML={{ __html: s.html }}
                    />
                  )}
                  {s.table && <DataTable table={s.table} />}
                  {chartsBySection.has(s.id) && <ChartWidget chart={chartsBySection.get(s.id)!} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:justify-end sm:items-center bg-black/20">
          <p className="text-xs text-gray-500 sm:mr-auto order-2 sm:order-1">
            Preview matches PDF layout: table first, then chart in each section.
          </p>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading || loading}
            className="btn-primary flex items-center justify-center gap-2 !py-2.5 order-1 sm:order-2 disabled:opacity-50"
          >
            {pdfLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Preparing PDF…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
