import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Building2, Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Hammer, Eye, EyeOff, Camera } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { UserRole } from '../types';

export default function SignUp() {
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const initialRole: UserRole = requestedRole === 'homeowner' ? 'Homeowner' : 'Contractor';
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isTradesman, setIsTradesman] = useState(false);
  const [trade, setTrade] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
    const { user, signup, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
  
    React.useEffect(() => {
      if (user) {
        navigate(user.role === 'admin' ? '/admin' : '/projects');
      }
    }, [user, navigate]);

    const compressImage = (base64Str: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions for profile photo
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress quality to ensure it fits in Firestore (under 1MB)
          // 0.7 quality is usually plenty for a 400x400 profile pic
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Limit to 5MB as requested
        if (file.size > 5 * 1024 * 1024) {
          setError('Image size must be less than 5MB');
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const compressed = await compressImage(base64);
          setAvatar(compressed);
        };
        reader.readAsDataURL(file);
      }
    };
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      // Basic validation
      if (!name || !email || !confirmEmail || !password) {
        setError('Please fill in all fields');
        return;
      }
  
      if (!email.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }

      if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
        setError('Email addresses do not match');
        return;
      }
  
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
  
      if (role === 'Contractor' && isTradesman && !trade) {
        setError('Please enter your trade');
        return;
      }
  
      setIsSubmitting(true);
      try {
        await signup(email.trim(), password, name, role, licenseNumber, avatar, isTradesman, trade);
        // Navigation is handled by the useEffect watching the user state
      } catch (err: any) {
        console.error('Signup error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setError('This email is already in use. Please try another or sign in.');
        } else if (err.code === 'auth/invalid-email') {
          setError('Please enter a valid email address.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password is too weak. Please use at least 6 characters.');
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
        await loginWithGoogle();
      } catch (err: any) {
        console.error(err);
        setError('Google sign-up failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-6 group">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-16 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>
          <h2 className="text-3xl font-black tracking-tight mb-2">Create Account</h2>
          <p className="text-slate-500 font-medium">Join the network and start building your vision</p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
              type="button"
              onClick={() => setRole('Contractor')}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-left group",
                role === 'Contractor' ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300", 
                role === 'Contractor' 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "bg-white text-slate-400 group-hover:text-primary group-hover:scale-110 group-hover:shadow-md"
              )}>
                <Hammer size={20} />
              </div>
              <p className={cn("font-bold text-sm transition-colors", role === 'Contractor' ? "text-primary" : "text-slate-600 group-hover:text-primary")}>Contractor</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Grow your business</p>
            </button>
            <button 
              type="button"
              onClick={() => setRole('Homeowner')}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-left group",
                role === 'Homeowner' ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300", 
                role === 'Homeowner' 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "bg-white text-slate-400 group-hover:text-primary group-hover:scale-110 group-hover:shadow-md"
              )}>
                <ShieldCheck size={20} />
              </div>
              <p className={cn("font-bold text-sm transition-colors", role === 'Homeowner' ? "text-primary" : "text-slate-600 group-hover:text-primary")}>Homeowner</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hire a professional</p>
            </button>
          </div>

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

            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-slate-50 shadow-inner bg-slate-100 flex items-center justify-center">
                    {avatar ? (
                      <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={40} className="text-slate-300" />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-xl shadow-lg cursor-pointer hover:scale-110 transition-transform">
                    <Camera size={18} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Upload Profile Photo (Optional)</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Full Name" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
                  />
                </div>
              </div>

              {role === 'Contractor' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input 
                      type="checkbox" 
                      id="isTradesman"
                      checked={isTradesman}
                      onChange={(e) => setIsTradesman(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all"
                    />
                    <label htmlFor="isTradesman" className="text-sm font-bold text-slate-600 cursor-pointer select-none">
                      I am a Tradesman (No License Required)
                    </label>
                  </div>

                  {isTradesman ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Trade</label>
                      <div className="relative group">
                        <Hammer className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                          type="text" 
                          value={trade}
                          onChange={(e) => setTrade(e.target.value)}
                          placeholder="e.g. Plumber, Electrician, Painter" 
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">Specify your primary trade or specialty</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Contractor License Number (Optional)</label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                          type="text" 
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value)}
                          placeholder="e.g. LIC-12345678" 
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">We will verify your license status to prevent fraud</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirm Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input 
                      type="email" 
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      placeholder="name@email.com" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters" 
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

            <div className="flex items-start gap-3 ml-1">
              <div className="w-5 h-5 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center mt-0.5">
                <CheckCircle2 size={12} className="text-emerald-600" />
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                By creating an account, you agree to our <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
              </p>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/30 hover:scale-[1.01] hover:-translate-y-1 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            <div className="relative my-6">
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
              <span>Sign up with Google</span>
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <p className="text-sm font-bold text-slate-500">
              Already have an account? <Link to="/login" className="text-primary hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
