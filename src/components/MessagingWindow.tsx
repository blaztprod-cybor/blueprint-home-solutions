import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, User, Search, Phone, Video, MoreVertical, Paperclip, Smile } from 'lucide-react';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  sender: 'me' | 'other';
  text: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  name: string;
  role: 'Homeowner' | 'Developer';
  lastMessage: string;
  time: string;
  unread?: number;
  online?: boolean;
  avatar?: string;
}

const MOCK_CONVERSATIONS: Conversation[] = [];

const MOCK_MESSAGES: Message[] = [];

interface MessagingWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MessagingWindow({ isOpen, onClose }: MessagingWindowProps) {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 w-[90vw] md:w-[800px] h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-[100] flex overflow-hidden"
        >
          {/* Sidebar */}
          <div className="w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black tracking-tight">Messages</h3>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors md:hidden">
                  <X size={20} />
                </button>
              </div>
              
              <div className="relative group mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="Search conversations..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {MOCK_CONVERSATIONS.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={cn(
                    "w-full p-4 rounded-2xl flex items-center gap-4 transition-all text-left group",
                    selectedConv?.id === conv.id ? "bg-white shadow-xl shadow-slate-200/50 border border-slate-100" : "hover:bg-white/50"
                  )}
                >
                  <div className="relative">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400">
                      <User size={24} />
                    </div>
                    {conv.online && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm truncate">{conv.name}</h4>
                      <span className="text-[10px] text-slate-400 font-medium">{conv.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate font-medium">{conv.lastMessage}</p>
                  </div>
                  {conv.unread && (
                    <div className="w-5 h-5 bg-primary text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                      {conv.unread}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                      <User size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{selectedConv.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{selectedConv.role}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors ml-2">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                  <div className="flex justify-center">
                    <span className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today</span>
                  </div>
                  {MOCK_MESSAGES.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.sender === 'me' ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] p-4 rounded-2xl text-sm font-medium shadow-sm",
                        msg.sender === 'me' 
                          ? "bg-primary text-white rounded-tr-none" 
                          : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                      )}>
                        {msg.text}
                        <div className={cn("text-[9px] mt-2 font-bold uppercase tracking-wider opacity-60", msg.sender === 'me' ? "text-right" : "text-left")}>
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <div className="p-6 border-t border-slate-100">
                  <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                      <Paperclip size={20} />
                    </button>
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..." 
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium"
                    />
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                      <Smile size={20} />
                    </button>
                    <button 
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        newMessage.trim() ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 scale-100" : "bg-slate-200 text-slate-400 scale-95"
                      )}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                  <Send size={40} />
                </div>
                <h3 className="text-xl font-black tracking-tight mb-2">Select a Conversation</h3>
                <p className="text-slate-500 max-w-xs font-medium">Choose a homeowner or developer to start communicating about your projects.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
