'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { StudentReportModal } from '@/components/StudentReportModal';
import { useSpeechToText, useTextToSpeech } from '@/hooks/useVoiceChat';
import { ChatMessage, StudentReportPayload } from '@/types';

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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 p-4 message-ai max-w-[80%] fade-in">
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} fade-in`}>
      <div className={`flex items-start gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1">
            AI
          </div>
        )}
        <div className={`p-4 ${isUser ? 'message-user' : 'message-ai'}`}>
          <p className="text-white whitespace-pre-wrap leading-relaxed">{message.content}</p>
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const initSession = async () => {
      if (!user) return;
      
      try {
        const session = await api.startChatSession({
          email: user.email,
          roll_number: user.roll_number,
          student_id: user.user_id,
          user_role: user.role,
        });
        setSessionId(session.session_id);
        
        const welcomeCopy =
          user.role === 'teacher'
            ? `Hello ${user.full_name}! 👋\n\nFaculty assistant: ask about your assigned courses, assignments you created, submission counts, and department announcements. Student fee/grade tools are not used here.\n\nWhat would you like to check?`
            : user.role === 'admin'
              ? `Hello ${user.full_name}! 👋\n\nStaff assistant: campus announcements and your admin profile. Ask in plain language.\n\nHow can I help?`
              : `Hello ${user.full_name}! 👋\n\nMain IBA Sukkur ka AI assistant hoon. Aap mujhse apne assignments, fees, exams, grades, ya documents ke baare mein pooch sakte hain.\n\nAaj kis cheez mein madad chahiye?`;
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content: welcomeCopy,
          timestamp: new Date(),
        };
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
    user?.role === 'teacher'
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
    <div className="min-h-screen gradient-bg flex flex-col">
      <StudentReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        report={reportData}
        loading={reportLoading}
        error={reportError}
      />
      {/* Header */}
      <header className="glass border-b border-white/10 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-semibold">IBA Assistant</h1>
              <div className="flex items-center gap-1.5">
                <div className="status-online" />
                <span className="text-xs text-gray-400">Online</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 glass-light px-3 py-2 rounded-xl">
              <div className="avatar-ring">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-sm font-medium">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
              </div>
              <div className="text-sm min-w-0">
                <p className="text-white font-medium truncate max-w-[140px] sm:max-w-[200px]">
                  {user?.full_name}
                </p>
                <p className="text-gray-400 text-xs truncate max-w-[140px] sm:max-w-[200px]">
                  {user?.role === 'student'
                    ? user?.roll_number || user?.email
                    : user?.role === 'teacher'
                      ? user?.employee_id || user?.email
                      : user?.email}
                </p>
              </div>
            </div>

            {/* Academic Report */}
            {user?.role === 'student' && (
              <button
                type="button"
                onClick={openStudentReport}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                title="Academic report"
                aria-label="Open academic report"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
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

      {/* Input Area */}
      <footer className="glass border-t border-white/10 p-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto">
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
          <div className="flex gap-2 items-stretch">
            <div
              className={`composer-bar ${
                user?.role === 'teacher'
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
  );
}
