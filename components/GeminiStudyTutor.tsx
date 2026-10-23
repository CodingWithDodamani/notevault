'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Brain,
  Zap,
  BookOpen,
  RotateCcw,
  Bot,
  User as UserIcon,
} from 'lucide-react';
import { VaultFile, ChatMessage } from '@/lib/types';
import { apiFetch, readApiError } from '@/lib/api-client';
import { useToast } from '@/lib/use-toast';

interface GeminiStudyTutorProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocument?: VaultFile | null;
}

const SUGGESTED_PROMPTS = [
  'Derive RRB NTPC Percentage successive formula shortcuts',
  'Summarize Indian Constitution Article 21 & Puttaswamy judgment',
  'Explain Michaelis-Menten enzyme kinetics Km and Vmax',
  'Give me 5 practice tips for Circular Seating Arrangement puzzles',
];

/**
 * Builds a chat message. Kept at module scope so the React Compiler does not
 * treat the timestamp/UUID generation as a render-time side effect.
 */
function makeMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${role}-${Math.random().toString(36).slice(2)}-${content.length}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function GeminiStudyTutor({
  isOpen,
  onClose,
  activeDocument,
}: GeminiStudyTutorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'model',
      content:
        'Hello! I am your NoteVault Study Mentor. I can explain formulas, quiz you on your notes, solve tricky reasoning puzzles, and summarize constitutional articles or biological pathways. How can I help your preparation today?',
      timestamp: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [useThinking, setUseThinking] = useState(true); // Default to high thinking for complex derivations
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Mirrors the latest conversation so a send always transmits the true
  // history rather than a stale render closure.
  const messagesRef = useRef<ChatMessage[]>(messages);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg = makeMessage('user', text);

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const activeDocContext = activeDocument
        ? `Document Name: ${activeDocument.name}\nSubject: ${activeDocument.subject}\nExam: ${activeDocument.exam}\nTopic: ${activeDocument.topic}\nNotes: ${activeDocument.description}\nSample Content Snippet:\n${activeDocument.samplePages?.join('\n---\n') || ''}`
        : undefined;

      // Build the outgoing history from the ref so concurrent sends cannot
      // duplicate or drop turns.
      const history = [...messagesRef.current, userMsg];
      messagesRef.current = history;

      const res = await apiFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          useThinking,
          activeDocumentContext: activeDocContext,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, 'The study assistant is unavailable right now.'));
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const modelMsg = makeMessage('model', data.text);
      modelMsg.thinking = data.usedThinking ? 'High Reasoning Mode (gemini-4-argon)' : undefined;

      const withReply = [...messagesRef.current, modelMsg];
      messagesRef.current = withReply;
      setMessages(withReply);
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const detail = err instanceof Error ? err.message : '';
      toast({
        title: 'Study assistant error',
        description: detail || 'Please check your connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    const reset: ChatMessage[] = [
      {
        id: 'msg-welcome',
        role: 'model',
        content:
          'Conversation reset. Ask any question about your study documents or exam syllabus.',
        timestamp: 'Just now',
      },
    ];
    messagesRef.current = reset;
    setMessages(reset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  NoteVault Study Tutor
                </h3>
                {useThinking ? (
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
                    gemini-4-argon · High Thinking
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    gemini-3.8-flash · Fast
                  </span>
                )}
              </div>
              {activeDocument && (
                <p className="text-[11px] text-zinc-500 truncate max-w-sm">
                  Active context: {activeDocument.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Thinking Mode Toggle */}
            <button
              onClick={() => setUseThinking(!useThinking)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors ${
                useThinking
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-medium'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Toggle deep reasoning mode for complex problems"
            >
              {useThinking ? <Brain className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{useThinking ? 'Thinking: High' : 'Fast Mode'}</span>
            </button>

            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeDocument && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <BookOpen className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">
                Grounding answers in:{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">
                  {activeDocument.name}
                </strong>{' '}
                ({activeDocument.subject} · {activeDocument.exam})
              </span>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
                    isUser
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-700/60'
                  }`}
                >
                  {m.thinking && (
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mb-1 pb-1 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                      <Brain className="w-3 h-3 text-zinc-500" />
                      <span>{m.thinking}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed">
                    {m.content}
                  </div>

                  <span
                    className={`block text-[10px] mt-1.5 tabular-nums text-right ${
                      isUser ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 text-xs leading-relaxed">
              <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-2.5 text-zinc-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" />
                <span
                  className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
                <span className="text-[11px] ml-1">
                  {useThinking
                    ? 'Reasoning through formula & exam syllabus...'
                    : 'Synthesizing study notes...'}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-zinc-400 shrink-0">Quick prompts:</span>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 whitespace-nowrap shrink-0 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your notes, formulas, or exams..."
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40 flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
