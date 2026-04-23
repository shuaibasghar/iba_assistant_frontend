'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { StudentReportModal } from '@/components/StudentReportModal';
import { ChatMessage, StudentReportPayload } from '@/types';

const quickActions = [
  { label: 'Assignments', icon: '📝', prompt: 'Show my pending assignments' },
  { label: 'Fees', icon: '💰', prompt: 'What is my fee status?' },
  { label: 'Exams', icon: '📅', prompt: 'When are my upcoming exams?' },
  { label: 'Grades', icon: '📊', prompt: 'Show my grades and CGPA' },
  { label: 'Documents', icon: '📄', prompt: 'I need to request a document' },
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

function MessageBubble({ message }: { message: ChatMessage }) {
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
          <p className={`text-xs mt-2 ${isUser ? 'text-white/60' : 'text-gray-500'}`}>
            {formatTime(message.timestamp)}
            {message.intent && !isUser && (
              <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full">{message.intent}</span>
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
        });
        setSessionId(session.session_id);
        
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content: `Hello ${user.full_name}! 👋\n\nMain IBA Sukkur ka AI assistant hoon. Aap mujhse apne assignments, fees, exams, grades, ya documents ke baare mein pooch sakte hain.\n\nAaj kis cheez mein madad chahiye?`,
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

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !sessionId || isTyping) return;

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
            {/* User info */}
            <div className="hidden sm:flex items-center gap-3 glass-light px-3 py-2 rounded-xl">
              <div className="avatar-ring">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-sm font-medium">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
              </div>
              <div className="text-sm">
                <p className="text-white font-medium">{user?.full_name}</p>
                <p className="text-gray-400 text-xs">{user?.roll_number || user?.email}</p>
              </div>
            </div>

            {user?.role === 'student' && (
              <button
                type="button"
                onClick={openStudentReport}
                className="btn-secondary flex items-center gap-2 !px-3 !py-2"
                title="View full academic report"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="hidden sm:inline">Report</span>
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
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="glass border-t border-white/10 p-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto">
          {/* Quick Actions */}
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

          {/* Input */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message... (English or Roman Urdu)"
                disabled={isTyping}
                className="input-modern pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                ↵
              </span>
            </div>
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isTyping}
              className="btn-primary !px-4 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
