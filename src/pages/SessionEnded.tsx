import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SessionEnded() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-12 text-center"
      >
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <LogOut size={40} className="text-primary" />
        </div>

        <h1 className="text-3xl font-black tracking-tight mb-4">You&apos;re Logged Out</h1>
        <div className="space-y-4 mb-10">
          <p className="text-slate-500 leading-relaxed">
            Your session has ended successfully. You can return to the homepage now or sign back in when you&apos;re ready.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Need Back In?</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Use your Blueprint Home Solutions account to sign in again and continue managing projects, leads, or messages.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Link
            to="/login"
            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform"
          >
            Sign In Again
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/"
            className="block w-full rounded-2xl border border-slate-200 px-8 py-4 font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
