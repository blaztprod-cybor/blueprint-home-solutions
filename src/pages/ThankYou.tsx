import React from 'react';
import { motion } from 'motion/react';
import { Building2, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-12 text-center"
      >
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Heart size={40} className="text-primary fill-primary/20" />
        </div>
        
        <h1 className="text-3xl font-black tracking-tight mb-4">Thank You!</h1>
        <p className="text-slate-500 leading-relaxed mb-10">
          You have been successfully logged out. We appreciate you choosing Blueprint Home Solutions for your home improvement journey.
        </p>

        <div className="space-y-4">
          <Link 
            to="/" 
            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform"
          >
            Back to Home
            <ArrowRight size={18} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
