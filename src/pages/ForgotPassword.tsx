import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Building2, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await resetPassword(email.trim());
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError(err.message || 'Failed to send password reset email. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100">
          <div className="flex flex-col items-center mb-10">
            <Link to="/" className="flex items-center mb-8 group">
              <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-16 w-auto object-contain transition-transform group-hover:scale-110" />
            </Link>
            <h2 className="text-3xl font-black tracking-tight text-center">Reset Password</h2>
            <p className="text-slate-500 font-medium text-center mt-3">
              Enter your email and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}

          {success ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-xl font-bold mb-2">Check your email</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                We've sent a password reset link to <span className="text-slate-900 font-bold">{email}</span>.
                <br />
                <span className="text-xs text-slate-400 mt-2 block italic">
                  It may take a few minutes to arrive. If you don't see it, please check your spam or junk folder.
                </span>
              </p>
              
              <div className="space-y-4">
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                  <span>Resend Link</span>
                </button>
                
                <div className="flex flex-col gap-3">
                  <Link 
                    to="/login" 
                    className="inline-flex items-center justify-center gap-2 text-primary font-bold hover:underline"
                  >
                    Back to Login <ArrowRight size={18} />
                  </Link>
                  <button 
                    onClick={() => { setSuccess(false); setError(''); }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                  >
                    Try a different email
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              <div className="text-center pt-4">
                <Link to="/login" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
