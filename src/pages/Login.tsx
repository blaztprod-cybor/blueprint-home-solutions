import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Building2, Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';

export default function Login() {
  const [email, setEmail] = useState(localStorage.getItem('blueprint_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('blueprint_remembered_email'));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portalRole = searchParams.get('role');
  const redirectTarget = searchParams.get('redirect');
  const category = searchParams.get('category');

  const welcomeText = portalRole === 'homeowner' 
    ? 'Welcome Homeowner' 
    : portalRole === 'contractor' 
      ? 'Welcome Home Pro' 
      : 'Welcome Back';

  React.useEffect(() => {
    if (user) {
      if (redirectTarget === 'start-project' && user.role === 'Homeowner') {
        navigate('/start-project', { state: { category } });
        return;
      }

      navigate(user.role === 'admin' ? '/admin' : '/projects');
    }
  }, [user, navigate, redirectTarget, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      
      if (rememberMe) {
        localStorage.setItem('blueprint_remembered_email', email.trim());
      } else {
        localStorage.removeItem('blueprint_remembered_email');
      }
      
      // Navigation is handled by the useEffect watching the user state
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(`The selected authentication method is not enabled in your Firebase project (blueprint-home-solutions). Please double-check that "Email/Password" is toggled to "Enabled" AND you clicked "Save" in the Firebase Console. If it is already enabled, try disabling and re-enabling it.`);
      } else {
        setError(`An error occurred: ${err.message || 'Please try again.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const requestedRole = portalRole === 'contractor'
        ? 'Contractor'
        : portalRole === 'homeowner'
          ? 'Homeowner'
          : undefined;
      await loginWithGoogle(requestedRole);
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled in Firebase Authentication. Enable Google under Authentication > Sign-in method.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in. Add localhost under Firebase Authentication > Settings > Authorized domains.');
      } else if (err?.code === 'auth/popup-blocked') {
        setError('The Google popup was blocked by the browser. Allow popups for localhost and try again.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setError('The Google sign-in popup was closed before completion.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setError('Another Google sign-in popup is already open or was interrupted. Close it and try again.');
      } else {
        setError(`Google sign-in failed: ${err?.code || err?.message || 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-6 group">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-16 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>
          <h2 className="text-3xl font-black tracking-tight mb-2">{welcomeText}</h2>
          <p className="text-slate-500 font-medium">Enter your credentials to access your portal</p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}

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
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                <Link to="/forgot-password" className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Forgot Password?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-1">
              <button 
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={cn(
                  "w-5 h-5 rounded border-2 transition-all flex items-center justify-center border-black",
                  rememberMe ? "bg-black text-white" : "bg-white"
                )}
              >
                {rememberMe && <Check size={14} strokeWidth={4} />}
              </button>
              <span className="text-sm font-bold text-slate-500 select-none cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>Remember me</span>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/30 hover:scale-[1.01] hover:-translate-y-1 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group disabled:opacity-70"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <p className="text-sm font-bold text-slate-500">
              Don't have an account? <Link to="/signup" className="text-primary hover:underline">Create Account</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
