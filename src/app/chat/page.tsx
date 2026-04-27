'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { StudentReportModal } from '@/components/StudentReportModal';
import { useSpeechToText, useTextToSpeech } from '@/hooks/useVoiceChat';
import { ChatMessage, StudentReportPayload } from '@/types';
import { portalChatSessionStorageKey } from '@/lib/portalChatSession';

const studentQuickActions = [
  { label: 'Assignments', icon: '📝', prompt: 'Show my pending assignments' },
  { label: 'Fees', icon: '💰', prompt: 'What is my fee status?' },
  { label: 'Exams', icon: '📅', prompt: 'When are my upcoming exams?' },
  { label: 'Grades', icon: '📊', prompt: 'Show my grades and CGPA' },
  { label: 'Documents', icon: '📄', prompt: 'I need to request a document' },
];

const teacherQuickActions = [
  { label: 'Teaching load', icon: '📚', prompt: 'Show assignments I created and submission counts by status' },
  { label: 'My courses', icon: '🎓', prompt: 'What courses am I assigned to teach?' },
  { label: 'Announcements', icon: '📣', prompt: 'What campus announcements apply to my department?' },
];

const adminQuickActions = [
  { label: 'Announcements', icon: '📣', prompt: 'List recent active campus announcements' },
  { label: 'My profile', icon: '👤', prompt: 'Summarize my staff profile from the portal' },
];

const superadminQuickActions = [
  { label: 'System overview', icon: '🏛️', prompt: 'Give a brief overview of the university data you can help me query as superadmin' },
  { label: 'Audit & safety', icon: '🔐', prompt: 'What sensitive or destructive actions should I be careful about, and what is typically audited?' },
  { label: 'Support escalations', icon: '⚡', prompt: 'How can I use this assistant to help with org-wide or cross-department issues?' },
  { label: 'Data scope', icon: '📊', prompt: 'Explain what I can and cannot do here compared to students and staff' },
];

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

/** Long URLs wrap; API-relative signed links become clickable absolute URLs. */
function formatChatMessageBody(raw: string): ReactNode {
  const re = /(https?:\/\/[^\s<]+[^\s<.,)]*|\/assignments\/attachment\/signed\?token=[^\s]+)/gi;
  const matches = [...raw.matchAll(re)];
  const wrapClass =
    'whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-w-full text-left';
  if (matches.length === 0) {
    return <div className={wrapClass}>{raw}</div>;
  }
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  const safeOrigin = API_ORIGIN;
  for (const m of matches) {
    const idx = m.index ?? 0;
    if (idx > last) {
      parts.push(<span key={`t${k++}`}>{raw.slice(last, idx)}</span>);
    }
    const link = m[1];
    const href = link.startsWith('http') ? link : `${safeOrigin}${link}`;
    parts.push(
      <a
        key={`a${k++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-300 underline underline-offset-2 decoration-cyan-300/70 break-all inline"
      >
        {href}
      </a>
    );
    last = idx + m[0].length;
  }
  if (last < raw.length) {
    parts.push(<span key={`t${k++}`}>{raw.slice(last)}</span>);
  }
  return <div className={wrapClass}>{parts}</div>;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 p-4 message-ai max-w-[92%] sm:max-w-[80%] fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm">
        AI
      </div>
      <div className="flex items-center gap-1.5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function MessageBubble({
  message,
  isSpeaking,
  onToggleSpeak,
}: {
  message: ChatMessage;
  isSpeaking?: boolean;
  onToggleSpeak?: () => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} fade-in min-w-0`}>
      <div
        className={`flex items-start gap-3 max-w-[92%] sm:max-w-[85%] min-w-0 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1">
            AI
          </div>
        )}
        <div
          className={`p-4 min-w-0 max-w-full overflow-x-hidden ${isUser ? 'message-user' : 'message-ai'}`}
        >
          <div className="text-white leading-relaxed">{formatChatMessageBody(message.content)}</div>
          <p className={`text-xs mt-2 flex items-center flex-wrap gap-2 ${isUser ? 'text-white/60' : 'text-gray-500'}`}>
            <span>
              {formatTime(message.timestamp)}
              {message.intent && !isUser && (
                <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full">{message.intent}</span>
              )}
            </span>
            {!isUser && onToggleSpeak && (
              <button
                type="button"
                onClick={onToggleSpeak}
                className={`p-1 rounded-lg transition-all ${
                  isSpeaking
                    ? 'text-cyan-300 bg-cyan-500/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/10'
                }`}
                title={isSpeaking ? 'Stop' : 'Read aloud'}
                aria-label={isSpeaking ? 'Stop reading' : 'Read message aloud'}
              >
                {isSpeaking ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                )}
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<StudentReportPayload | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  /** Mobile / tablet: slide-over nav; desktop (lg+) always visible */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isListening,
    isSupported: voiceInputSupported,
    voiceError,
    setVoiceError,
    startListening,
    stopListening,
    cancelVoiceInput,
  } = useSpeechToText();
  /** Text in the field before the current voice session (restore on cancel) */
  const voiceTextPrefixRef = useRef('');
  const { speak: speakMessage, stop: stopSpeaking, activeSpeechId } = useTextToSpeech();

  const roleKey = (user?.role || '').toLowerCase();
  const isSuperadmin =
    roleKey === 'superadmin' || roleKey === 'superuser';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => mq.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isNarrow = window.matchMedia('(max-width: 1023px)').matches;
    if (sidebarOpen && isNarrow) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [sidebarOpen]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const initSession = async () => {
      if (!user) return;

      const storageKey = portalChatSessionStorageKey(user.user_id);
      const r = (user.role || '').toLowerCase();

      const welcomeCopy =
        r === 'superadmin' || r === 'superuser'
          ? `Hello ${user.full_name}! 👋\n\nMain yahan system superadmin console ke liye AI assistant hoon. Pooray org ka data, staff / operations, audit trails, aur escalations yahan in-scope hain—student wali self-service nahi: maslan personal fees, apni grades, ya bachon ke documents ka personal portal wala tajurba yahan maksad nahi.\n\nAap English ya Roman Urdu mein pooch sakte hain. Aaj kis cheez mein madad chahiye?`
          : r === 'teacher'
            ? `Hello ${user.full_name}! 👋\n\nFaculty assistant: ask about your assigned courses, assignments you created, submission counts, and department announcements. Student fee/grade tools are not used here.\n\nWhat would you like to check?`
            : r === 'admin'
              ? `Hello ${user.full_name}! 👋\n\nStaff assistant: campus announcements and your admin profile. Ask in plain language.\n\nHow can I help?`
              : `Hello ${user.full_name}! 👋\n\nMain IBA Sukkur ka AI assistant hoon. Aap mujhse apne assignments, fees, exams, grades, ya documents ke baare mein pooch sakte hain.\n\nAaj kis cheez mein madad chahiye?`;
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: welcomeCopy,
        timestamp: new Date(),
      };

      const tryResumeSavedSession = async (): Promise<boolean> => {
        const savedId = localStorage.getItem(storageKey);
        if (!savedId) return false;
        try {
          const hist = await api.getChatHistory(savedId);
          setSessionId(savedId);
          if (hist.messages?.length) {
            const restored: ChatMessage[] = hist.messages.map((m, i) => ({
              id: `restored-${i}-${savedId.slice(0, 8)}`,
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content,
              timestamp: new Date(),
            }));
            setMessages(restored);
          } else {
            setMessages([welcomeMessage]);
          }
          return true;
        } catch {
          localStorage.removeItem(storageKey);
          return false;
        }
      };

      try {
        const resumed = await tryResumeSavedSession();
        if (resumed) {
          return;
        }

        const session = await api.startChatSession({
          email: user.email,
          roll_number: user.roll_number,
          student_id: user.user_id,
          user_role: user.role,
        });
        localStorage.setItem(storageKey, session.session_id);
        setSessionId(session.session_id);
        setMessages([welcomeMessage]);
      } catch (error) {
        console.error('Failed to start session:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    if (user) {
      initSession();
    }
  }, [user]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !sessionId || isTyping) return;

      stopSpeaking();

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsTyping(true);

      try {
        const response = await api.sendMessage(sessionId, content);

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(response.timestamp),
          intent: response.intent,
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
        inputRef.current?.focus();
      }
    },
    [sessionId, isTyping, stopSpeaking]
  );

  const mergeVoiceWithPrefix = useCallback((voiceChunk: string) => {
    const p = voiceTextPrefixRef.current;
    const v = voiceChunk.trim();
    if (!v) {
      return p;
    }
    if (!p) {
      return v;
    }
    return `${p} ${v}`;
  }, []);

  const toggleVoiceInput = () => {
    setVoiceError(null);
    if (isListening) {
      stopListening();
      return;
    }
    if (!sessionId || isTyping) return;
    voiceTextPrefixRef.current = inputValue;
    startListening(
      (interim) => {
        setInputValue(mergeVoiceWithPrefix(interim));
      },
      (finalVoice) => {
        setInputValue(mergeVoiceWithPrefix(finalVoice));
      },
      () => {
        setInputValue(voiceTextPrefixRef.current);
      }
    );
  };

  const handleCancelVoice = () => {
    setVoiceError(null);
    cancelVoiceInput();
  };

  const toggleAssistantSpeak = (id: string, text: string) => {
    if (activeSpeechId === id) {
      stopSpeaking();
    } else {
      speakMessage(id, text);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const openStudentReport = async () => {
    if (user?.role !== 'student') return;
    setReportOpen(true);
    setReportLoading(true);
    setReportError(null);
    setReportData(null);
    try {
      const data = await api.getStudentReport();
      setReportData(data);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Could not load report.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleLogout = async () => {
    setSidebarOpen(false);
    if (user) {
      localStorage.removeItem(portalChatSessionStorageKey(user.user_id));
    }
    if (sessionId) {
      try {
        await api.endChatSession(sessionId);
      } catch {
        // Ignore error
      }
    }
    await logout();
    router.push('/login');
  };

  const quickActions =
    isSuperadmin
      ? superadminQuickActions
      : user?.role === 'teacher'
        ? teacherQuickActions
        : user?.role === 'admin'
          ? adminQuickActions
          : studentQuickActions;

  if (authLoading || isInitializing) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 pulse-glow">
            <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-400">Initializing chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg relative h-dvh max-h-dvh overflow-hidden">
      <StudentReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        report={reportData}
        loading={reportLoading}
        error={reportError}
      />

      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Left sidebar — drawer on small screens, fixed column on lg+ */}
      <aside
        id="chat-sidebar"
        className={`glass border-r border-white/10 w-[min(280px,100vw-3rem)] sm:w-[260px] flex flex-col z-50 fixed left-0 top-0 bottom-0 overflow-y-auto overscroll-contain transition-transform duration-200 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm leading-tight">
                {isSuperadmin ? 'System console' : 'IBA Assistant'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="status-online" />
                <span className="text-xs text-gray-400">Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 flex flex-col gap-2 p-4">
          {user?.role === 'student' && (
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                void openStudentReport();
              }}
              className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-gray-300 transition-all hover:bg-white/10 hover:text-white"
            >
              <svg className="h-5 w-5 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Academic report
            </button>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-white/10 p-4">
          <div className="glass-light flex items-center gap-3 rounded-xl p-3">
            <div className="avatar-ring shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-sm font-medium text-white">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-white">{user?.full_name}</p>
              <p className="truncate text-xs text-gray-400">
                {user?.role === 'student'
                  ? user?.roll_number || user?.email
                  : user?.role === 'teacher' || isSuperadmin
                    ? user?.employee_id || user?.email
                    : user?.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-gray-300 transition-all hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main chat column — full width on small screens; offset for sidebar on lg+ */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden pl-0 lg:pl-[260px]">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[rgba(15,15,26,0.85)] px-3 py-2.5 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/90 transition-colors hover:bg-white/10"
            aria-expanded={sidebarOpen}
            aria-controls="chat-sidebar"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {isSuperadmin ? 'System console' : 'IBA Assistant'}
            </p>
            <p className="truncate text-xs text-gray-500">Menu · profile · logout</p>
          </div>
        </header>
        {/* Messages — sole scroll region */}
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-4 sm:py-6">
          <div className="mx-auto max-w-4xl min-w-0 space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isSpeaking={message.role === 'assistant' && activeSpeechId === message.id}
                onToggleSpeak={
                  message.role === 'assistant'
                    ? () => toggleAssistantSpeak(message.id, message.content)
                    : undefined
                }
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Area — pinned below messages */}
        <footer className="glass shrink-0 overflow-x-hidden border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-4">
          <div className="mx-auto w-full min-w-0 max-w-4xl">
          {/* Quick Actions */}
          {voiceError && (
            <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
              <span className="pt-0.5">{voiceError}</span>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="shrink-0 rounded-lg px-2 py-0.5 text-amber-200/80 hover:bg-white/10"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSendMessage(action.prompt)}
                disabled={isTyping}
                className="chip flex items-center gap-2 disabled:opacity-50"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* Composer: actions + input (messaging-app style) */}
          <div className="flex gap-2 items-stretch min-w-0 w-full">
            <div
              className={`composer-bar ${
                isSuperadmin
                  ? 'composer-bar--superadmin'
                  : user?.role === 'teacher'
                    ? 'composer-bar--teacher'
                    : user?.role === 'admin'
                      ? 'composer-bar--admin'
                      : 'composer-bar--student'
              }`}
            >
              <div className="composer-toolbar">
                {(user?.role === 'teacher' || user?.role === 'student' || user?.role === 'admin') && (
                  <>
                    <input
                      type="file"
                      id="upload-chat-input"
                      className="hidden"
                      accept=".pdf,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!sessionId) return;
                          
                          setIsTyping(true);
                          const userMsg: ChatMessage = {
                            id: Date.now().toString(),
                            role: 'user',
                            content: `[Uploaded document: ${file.name}]`,
                            timestamp: new Date(),
                          };
                          setMessages((prev) => [...prev, userMsg]);
                          
                          try {
                            const res = await api.uploadChatFile(sessionId, file);
                            const aiMsg: ChatMessage = {
                              id: (Date.now() + 1).toString(),
                              role: 'assistant',
                              content: res.message,
                              timestamp: new Date(),
                            };
                            setMessages((prev) => [...prev, aiMsg]);
                          } catch (err) {
                            const aiMsg: ChatMessage = {
                              id: (Date.now() + 1).toString(),
                              role: 'assistant',
                              content: `Error: ${err instanceof Error ? err.message : 'Upload failed'}`,
                              timestamp: new Date(),
                            };
                            setMessages((prev) => [...prev, aiMsg]);
                          } finally {
                            setIsTyping(false);
                            e.target.value = ''; // Reset input
                            scrollToBottom();
                          }
                        }
                      }}
                    />
                    <label
                      htmlFor="upload-chat-input"
                      className="composer-icon-btn flex items-center justify-center !text-rose-300/90 hover:!text-rose-200 cursor-pointer"
                      title="Upload document"
                      aria-label="Upload document"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-5 h-5">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                    </label>
                  </>
                )}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={!voiceInputSupported || isTyping || !sessionId}
                  className={`composer-icon-btn flex items-center justify-center ${
                    isListening ? 'composer-icon-btn--voice-active' : 'text-cyan-300/80 hover:text-cyan-200'
                  } ${!voiceInputSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={
                    !voiceInputSupported
                      ? 'Voice input needs Chrome or Edge on desktop'
                      : isListening
                        ? 'Done: stop mic — text stays; press Send, or Cancel to discard'
                        : 'Speak your message (does not send until you press Send)'
                  }
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Finish voice input (keep text in field)' : 'Start voice input'}
                >
                  {isListening ? (
                    <span className="flex h-3 w-3 items-center justify-center" aria-hidden>
                      <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
                    </span>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  )}
                </button>
                {isListening && (
                  <button
                    type="button"
                    onClick={handleCancelVoice}
                    className="composer-icon-btn flex items-center justify-center !text-amber-200/90 hover:!text-amber-100"
                    title="Cancel voice: discard this dictation and restore what you had before the mic"
                    aria-label="Cancel voice input and discard text"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <input
                ref={inputRef}
                className="composer-field"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  isListening
                    ? 'Listening… (tap mic to finish, then Send, or the X to cancel voice)'
                    : isSuperadmin
                      ? 'Message… (org-wide, English or Roman Urdu)'
                      : 'Message… (English or Roman Urdu)'
                }
                disabled={isTyping}
              />
            </div>
            <button
              type="button"
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isTyping}
              className="btn-primary !px-4 shrink-0 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send"
            >
              {isTyping ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
