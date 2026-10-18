import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Conversation, Message } from '../types';
import {
  MessageSquare,
  Send,
  Phone,
  User,
  Check,
  CheckCheck,
  AlertCircle,
  ShieldCheck,
  Info,
} from 'lucide-react';

export const ConversationsPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
      if (res.data.length > 0 && !activeConversationId) {
        setActiveConversationId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const fetchThread = async (id: string) => {
    try {
      const res = await api.get(`/conversations/${id}/messages`);
      setActiveThread(res.data);
    } catch (err) {
      console.error('Failed to load messages thread:', err);
    }
  };

  const checkIntegration = async () => {
    try {
      const res = await api.get('/integrations');
      const wa = res.data.find((i: any) => i.code === 'WHATSAPP');
      setWhatsappStatus(wa);
    } catch (err) {
      console.error('Failed to check WhatsApp integration:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
    checkIntegration();

    const socket = getSocket();
    if (socket) {
      const handleIncoming = (data: any) => {
        fetchConversations();
        if (data.conversationId === activeConversationId) {
          fetchThread(data.conversationId);
        }
      };
      socket.on('incoming_message', handleIncoming);
      socket.on('message_sent', handleIncoming);

      return () => {
        socket.off('incoming_message', handleIncoming);
        socket.off('message_sent', handleIncoming);
      };
    }
  }, [activeConversationId]);

  useEffect(() => {
    if (activeConversationId) {
      fetchThread(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversationId || sending) return;

    setSending(true);
    try {
      await api.post(`/conversations/${activeConversationId}/messages`, {
        content: inputText,
      });
      setInputText('');
      fetchThread(activeConversationId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send WhatsApp message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      {/* WhatsApp Provider Status Banner */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-800">Meta WhatsApp Cloud API Gateway</div>
            <div className="text-slate-500">
              Two-way messaging with automatic lead capture & customer profile association
            </div>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${
            whatsappStatus?.isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {whatsappStatus?.statusLabel || 'Checking...'}
        </span>
      </div>

      {/* Main Messaging Interface */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex min-h-0">
        {/* Left Side: Conversation List */}
        <div className="w-80 border-r border-slate-200 flex flex-col h-full bg-slate-50/50 flex-shrink-0">
          <div className="p-3.5 border-b border-slate-200 bg-white">
            <div className="text-xs font-bold text-whitepace-navy uppercase tracking-wider">
              Conversations ({conversations.length})
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No conversations yet. Inbound WhatsApp messages will automatically appear here!
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const lastMsg = conv.messages?.[0];

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`p-3.5 cursor-pointer transition ${
                      isActive ? 'bg-white shadow-sm border-l-4 border-l-whitepace-blue' : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 truncate">{conv.contact.name}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{conv.contact.phone}</div>
                    {lastMsg && (
                      <div className="text-xs text-slate-600 truncate mt-1">
                        {lastMsg.direction === 'OUTBOUND' && <span className="font-semibold text-whitepace-blue">You: </span>}
                        {lastMsg.content}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Message Thread View */}
        <div className="flex-1 flex flex-col h-full bg-white min-w-0">
          {activeThread ? (
            <>
              {/* Thread Header */}
              <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-sm">
                    {activeThread.contact.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{activeThread.contact.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{activeThread.contact.phone}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      activeThread.contact.consentStatus === 'OPTED_IN'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {activeThread.contact.consentStatus}
                  </span>
                </div>
              </div>

              {/* Messages Bubble Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 custom-scrollbar">
                {activeThread.messages?.map((msg) => {
                  const isOutbound = msg.direction === 'OUTBOUND';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-2.5 rounded-2xl text-xs shadow-sm leading-relaxed ${
                          isOutbound
                            ? 'bg-whitepace-navy text-white rounded-br-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className="flex items-center space-x-1 mt-1 text-[10px] text-slate-400 px-1">
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isOutbound && (
                          <span title={msg.status}>
                            <CheckCheck className="w-3.5 h-3.5 text-whitepace-blue" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input Field */}
              <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a WhatsApp message (qualifies as lead response)..."
                    disabled={sending}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    className="px-5 py-2.5 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center space-x-1.5"
                  >
                    <span>{sending ? 'Sending...' : 'Send'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              Select a conversation to start messaging.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
