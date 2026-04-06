import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Mail, 
  Shield, 
  CreditCard, 
  Camera,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Hammer
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';

export default function ProfileSettings() {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    street: user?.street || '',
    town: user?.town || '',
    zip: user?.zip || '',
    governmentIdImage: user?.governmentIdImage || '',
    licenseNumber: user?.licenseNumber || '',
    isTradesman: user?.isTradesman || false,
    trade: user?.trade || '',
    notifyOnNewProjects: user?.notifyOnNewProjects ?? (user?.role === 'Contractor'),
    notifyOnRoughEstimates: user?.notifyOnRoughEstimates ?? (user?.role === 'Homeowner'),
    notifyOnProductUpdates: user?.notifyOnProductUpdates ?? false,
    notifyOnSmsLeadAlerts: user?.notifyOnSmsLeadAlerts ?? false,
  });
  const governmentIdInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      street: user?.street || '',
      town: user?.town || '',
      zip: user?.zip || '',
      governmentIdImage: user?.governmentIdImage || '',
      licenseNumber: user?.licenseNumber || '',
      isTradesman: user?.isTradesman || false,
      trade: user?.trade || ''
      ,
      notifyOnNewProjects: user?.notifyOnNewProjects ?? (user?.role === 'Contractor'),
      notifyOnRoughEstimates: user?.notifyOnRoughEstimates ?? (user?.role === 'Homeowner'),
      notifyOnProductUpdates: user?.notifyOnProductUpdates ?? false,
      notifyOnSmsLeadAlerts: user?.notifyOnSmsLeadAlerts ?? false,
    });
  }, [
    user?.name,
    user?.email,
    user?.phone,
    user?.street,
    user?.town,
    user?.zip,
    user?.governmentIdImage,
    user?.licenseNumber,
    user?.isTradesman,
    user?.trade,
    user?.notifyOnNewProjects,
    user?.notifyOnRoughEstimates,
    user?.notifyOnProductUpdates,
    user?.notifyOnSmsLeadAlerts,
    user?.role,
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      if (user.role === 'Contractor') {
        if (!user.avatar || user.avatar.startsWith('data:image/svg+xml')) {
          throw new Error('A real profile photo is required for contractor accounts.');
        }

        if (!formData.phone.trim() || !formData.street.trim() || !formData.town.trim() || !formData.zip.trim() || !formData.governmentIdImage.trim()) {
          throw new Error('Phone, full address, town, zip code, and a government ID photo are required for contractor accounts.');
        }

        if (formData.isTradesman && !formData.trade.trim()) {
          throw new Error('Tradesmen must provide a trade or specialty.');
        }

        if (!formData.isTradesman && !formData.licenseNumber.trim()) {
          throw new Error('Licensed contractors must provide a contractor license number.');
        }
      }

      await updateProfile({
        name: formData.name,
        phone: formData.phone,
        street: formData.street,
        town: formData.town,
        zip: formData.zip,
        governmentIdImage: formData.governmentIdImage,
        licenseNumber: formData.licenseNumber,
        isTradesman: formData.isTradesman,
        trade: formData.trade
        ,
        notifyOnNewProjects: formData.notifyOnNewProjects,
        notifyOnRoughEstimates: formData.notifyOnRoughEstimates,
        notifyOnProductUpdates: formData.notifyOnProductUpdates,
        notifyOnSmsLeadAlerts: formData.notifyOnSmsLeadAlerts,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

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
        try {
          await updateProfile({ avatar: compressed });
        } catch (err: any) {
          setError('Failed to upload photo');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGovernmentIdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const compressed = await compressImage(base64);
      setFormData((current) => ({ ...current, governmentIdImage: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'profile', label: 'Profile Info', icon: User },
    ...(user?.role === 'Contractor' ? [{ id: 'billing', label: 'Billing & Plans', icon: CreditCard }] : []),
  ];

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and subscription.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-white text-primary shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
                <Shield size={16} />
                {error}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="relative group">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-slate-50 shadow-inner bg-slate-100 flex items-center justify-center">
                  <img src={user.avatar} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
                {user.role === 'Contractor' && (
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Profile Photo
                  </p>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{user.name}</h2>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1 w-fit',
                    user.isVerified ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'
                  )}>
                    <CheckCircle2 size={10} />
                    {user.isVerified ? `Verified ${user.role}` : `${user.role} Pending Review`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <Mail size={14} />
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20" 
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone Number</label>
                <input 
                  type="tel" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20" 
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {user.role === 'Contractor' ? 'Permanent / Business Address' : 'Street Address (Optional)'}
                </label>
                <input 
                  type="text" 
                  value={formData.street} 
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder=""
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Town / City</label>
                <input 
                  type="text" 
                  value={formData.town} 
                  onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Zip Code</label>
                <input 
                  type="text" 
                  value={formData.zip} 
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20" 
                />
              </div>

              {user.role === 'Contractor' && (
                <div className="md:col-span-2 space-y-6 pt-4 border-t border-slate-100">
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Alerts</p>
                    <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <input
                        type="checkbox"
                        checked={formData.notifyOnNewProjects}
                        onChange={(e) => setFormData({ ...formData, notifyOnNewProjects: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all"
                      />
                      <span className="text-sm font-bold text-slate-600">
                        Email me whenever a new homeowner project is submitted
                      </span>
                    </label>
                    <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <input
                        type="checkbox"
                        checked={formData.notifyOnSmsLeadAlerts}
                        onChange={(e) => setFormData({ ...formData, notifyOnSmsLeadAlerts: e.target.checked })}
                        className="mt-0.5 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all"
                      />
                      <span className="text-sm font-bold text-slate-600">
                        Text me when Blueprint has a new lead or important contractor update
                        <span className="mt-1 block text-xs font-medium text-slate-400">
                          Uses your saved phone number and requires SMS consent.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <input
                        type="checkbox"
                        checked={formData.notifyOnProductUpdates}
                        onChange={(e) => setFormData({ ...formData, notifyOnProductUpdates: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all"
                      />
                      <span className="text-sm font-bold text-slate-600">
                        Email me product updates, feature announcements, and Blueprint news
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Upload Government ID / Driver's License</label>
                    <label className="flex min-h-[72px] cursor-pointer items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-slate-100/70">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                        <Camera size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-700">
                          {formData.governmentIdImage ? 'Government ID uploaded' : 'Upload ID'}
                        </p>
                      </div>
                      <input
                        type="file"
                        ref={governmentIdInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleGovernmentIdChange}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input 
                      type="checkbox" 
                      id="isTradesman"
                      checked={formData.isTradesman}
                      onChange={(e) => setFormData({ ...formData, isTradesman: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all"
                    />
                    <label htmlFor="isTradesman" className="text-sm font-bold text-slate-600 cursor-pointer select-none">
                      Mark this account as an Unlicensed Tradesman
                    </label>
                  </div>

                  {formData.isTradesman ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Trade</label>
                      <div className="relative group">
                        <Hammer className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                          type="text" 
                          value={formData.trade}
                          onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                          placeholder="" 
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Contractor Or Trade License Number</label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                          type="text" 
                          value={formData.licenseNumber}
                          onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                          placeholder="" 
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {user.role === 'Homeowner' && (
                <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Alerts</p>
                  <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input
                      type="checkbox"
                      checked={formData.notifyOnRoughEstimates}
                      onChange={(e) => setFormData({ ...formData, notifyOnRoughEstimates: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all"
                    />
                    <span className="text-sm font-bold text-slate-600">
                      Email me whenever a contractor submits a rough estimate on my project
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input
                      type="checkbox"
                      checked={formData.notifyOnProductUpdates}
                      onChange={(e) => setFormData({ ...formData, notifyOnProductUpdates: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all"
                    />
                    <span className="text-sm font-bold text-slate-600">
                      Email me product updates, feature announcements, and Blueprint news
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-end gap-6">
              <AnimatePresence>
                {isSaved && (
                  <motion.p 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    Changes saved to database
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                hit save to update user information
              </p>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                  "px-12 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed",
                  isSaving && "animate-pulse"
                )}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    Saving...
                  </div>
                ) : 'Save'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
