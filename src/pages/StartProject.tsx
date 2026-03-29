import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar,
  MapPin,
  Phone,
  Upload,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  Camera,
  X,
  Loader2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { projectCategories as services } from '../data/projectCategories';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s./-]*\d{3}[\s./-]*\d{4}\b/;
const DIGIT_WORDS = new Set(['zero', 'oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']);
const SQUARE_FOOTAGE_SERVICE_IDS = new Set(['bathrooms', 'kitchens', 'basements', 'floors']);

const containsBlockedContactInfo = (value: string) => {
  if (!value) return false;

  if (EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value)) {
    return true;
  }

  const tokens = value.toLowerCase().match(/[a-z]+/g) || [];
  let consecutiveDigitWords = 0;

  for (const token of tokens) {
    if (DIGIT_WORDS.has(token)) {
      consecutiveDigitWords += 1;
      if (consecutiveDigitWords >= 7) {
        return true;
      }
    } else {
      consecutiveDigitWords = 0;
    }
  }

  return false;
};

export default function StartProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const initialCategory = location.state?.category;
  const [selectedServices, setSelectedServices] = useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [formData, setFormData] = useState({
    street: '',
    town: '',
    zip: '',
    phone: '',
    startDate: '',
    description: '',
    lengthFt: '',
    widthFt: '',
  });
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [submittedProjectId, setSubmittedProjectId] = useState('');
  const redirectTimerRef = useRef<number | null>(null);

  const selectedServiceTitles = useMemo(
    () => services
      .filter(service => selectedServices.includes(service.id))
      .map(service => service.title),
    [selectedServices]
  );
  const needsSquareFootage = selectedServices.some(service => SQUARE_FOOTAGE_SERVICE_IDS.has(service));
  const estimatedSquareFootage = needsSquareFootage
    ? (Number(formData.lengthFt) || 0) * (Number(formData.widthFt) || 0)
    : 0;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const toggleService = (id: string) => {
    setSelectedServices(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedPhotos(prev => [...prev, ...files].slice(0, 10));
    }
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/signup?role=homeowner', {
        state: {
          category: selectedServices[0] || initialCategory || null,
        },
      });
      return;
    }

    if (containsBlockedContactInfo(formData.description)) {
      setDescriptionError('Please remove phone numbers and email addresses from the project description.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const projectTitle = selectedServices.length > 0 
        ? `${services.find(s => s.id === selectedServices[0])?.title} Project`
        : "New Home Project";

      // 1. Convert photos to base64 first (needed for both DB and Email)
      console.log("[StartProject] Converting photos to base64...");
      const photoBase64s = await Promise.all(
        selectedPhotos.map(file => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        })
      );

      // 2. Save to Firestore
      console.log("[StartProject] Attempting to save project to Firestore...");
      const projectData = {
        uid: user.id,
        title: projectTitle,
        description: formData.description,
        category: selectedServices.length > 0 ? services.find(s => s.id === selectedServices[0])?.title : "General",
        status: 'New Open Project' as const,
        budget: 0,
        startDate: formData.startDate,
        location: {
          street: formData.street,
          town: formData.town,
          zip: formData.zip
        },
        phone: formData.phone,
        services: selectedServices,
        photoCount: selectedPhotos.length,
        photos: photoBase64s.slice(0, 3), // Keep first 3 as preview
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log("[StartProject] Project saved successfully with ID:", docRef.id);

      // 3. Save all photos to subcollection
      console.log("[StartProject] Saving all photos to subcollection...");
      await Promise.all(
        photoBase64s.map(base64 => 
          addDoc(collection(db, 'projects', docRef.id, 'photos'), {
            url: base64,
            createdAt: new Date().toISOString(),
            uid: user.id
          })
        )
      );
      console.log("[StartProject] All photos saved to subcollection.");

      // 4. Show success state
      setSubmittedProjectId(docRef.id);
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/projects', {
          state: {
            highlightProjectId: docRef.id,
            projectSubmitted: true
          }
        });
      }, 5000);

      // 4. Background: Send confirmation email
      (async () => {
        try {
          console.log("[StartProject] Background: Sending confirmation email...");
          const emailResponse = await fetch('/api/send-project-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              projectTitle,
              startDate: formData.startDate,
              description: formData.description || `Project at ${formData.street}, ${formData.town} ${formData.zip}. Services: ${selectedServiceTitles.join(', ')}`,
              photos: photoBase64s.slice(0, 5) // Limit to 5 photos for email
            })
          });
          const emailResult = await emailResponse.json();
          console.log("[StartProject] Background: Email API response:", emailResult);
        } catch (bgError) {
          console.error("[StartProject] Background task failed:", bgError);
        }
      })();
    } catch (error) {
      console.error("Error creating project:", error);
      handleFirestoreError(error, OperationType.WRITE, 'projects');
      alert("Failed to create project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-xl transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Start New</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {isSubmitted && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-[2rem] border border-emerald-200 bg-white p-8 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Project Submitted</p>
                  <h2 className="text-3xl font-black leading-tight text-slate-950">Your project request has been submitted.</h2>
                </div>
                <p className="text-sm font-medium leading-7 text-slate-600">
                  Your information and photos have been saved. You can open My Projects now to track the request inside your homeowner portal.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/projects', {
                      state: {
                        highlightProjectId: submittedProjectId,
                        projectSubmitted: true
                      }
                    })}
                    className="rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Go To My Projects
                  </button>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    This window will close in 5 seconds.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Services Checklist */}
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <label
                key={service.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group",
                  selectedServices.includes(service.id)
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-white border-slate-200 hover:border-primary/30 hover:shadow-md"
                )}
              >
                <div className="relative flex items-center">
                  <input 
                    type="checkbox"
                    checked={selectedServices.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary transition-all cursor-pointer"
                  />
                </div>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
                  selectedServices.includes(service.id)
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-slate-50 border-slate-100 group-hover:border-primary/20 text-slate-400"
                )}>
                  <service.icon size={20} />
                </div>
                <span className={cn(
                  "font-bold text-sm",
                  selectedServices.includes(service.id) ? "text-slate-900" : "text-slate-600"
                )}>
                  {service.title}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Address & Contact */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Project Location & Contact</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Street Address</label>
                <input 
                  required
                  type="text" 
                  placeholder="123 Main St" 
                  disabled={isSubmitted}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={formData.street}
                  onChange={e => setFormData({...formData, street: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Town / City</label>
                <input 
                  required
                  type="text" 
                  placeholder="Queens" 
                  disabled={isSubmitted}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={formData.town}
                  onChange={e => setFormData({...formData, town: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Zip Code</label>
                <input 
                  required
                  type="text" 
                  placeholder="11101" 
                  disabled={isSubmitted}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={formData.zip}
                  onChange={e => setFormData({...formData, zip: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  required
                  type="tel" 
                  placeholder="(555) 000-0000" 
                  disabled={isSubmitted}
                  className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Timeline & Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Projected Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  required
                  type="date" 
                  min={new Date().toISOString().split('T')[0]}
                  disabled={isSubmitted}
                  className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={formData.startDate}
                  onChange={e => setFormData({...formData, startDate: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Project Description</label>
              <textarea 
                required
                placeholder="Briefly describe the improvements or repairs needed..." 
                disabled={isSubmitted}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium min-h-[120px]"
                value={formData.description}
                onChange={e => {
                  const nextValue = e.target.value;
                  setFormData({...formData, description: nextValue});
                  setDescriptionError(
                    containsBlockedContactInfo(nextValue)
                      ? 'Please remove phone numbers and email addresses from the project description.'
                      : ''
                  );
                }}
              />
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Please do not include phone numbers or email addresses in the project description.
              </p>
              {descriptionError && (
                <p className="text-sm font-bold text-red-600">{descriptionError}</p>
              )}
            </div>
          </div>
        </section>

        {needsSquareFootage && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <Home size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Estimated Room Size</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Length (ft)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  disabled={isSubmitted}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={formData.lengthFt}
                  onChange={e => setFormData({...formData, lengthFt: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Width (ft)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  disabled={isSubmitted}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={formData.widthFt}
                  onChange={e => setFormData({...formData, widthFt: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Estimated Square Footage</label>
                <div className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900">
                  {estimatedSquareFootage > 0 ? `${estimatedSquareFootage.toFixed(1)} sq ft` : 'Add room dimensions'}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Calculator only. This estimate is not saved to the project.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Media Upload */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Camera size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Photos</h2>
          </div>
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-8 md:p-12 text-center space-y-6 hover:border-primary/30 transition-colors group">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              multiple
              accept="image/*"
              disabled={isSubmitted}
              className="hidden"
            />
            
            {selectedPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {selectedPhotos.map((file, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden group/photo">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover/photo:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {selectedPhotos.length < 10 && (
                  <button
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary/30 hover:text-primary transition-all"
                  >
                    <Camera size={20} />
                    <span className="text-[10px] font-bold uppercase">Add More</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="font-bold text-slate-900">Add up to 10 photos</p>
                  <p className="text-sm text-slate-500 font-medium">Upload photos of the area that needs work</p>
                </div>
                <button 
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 mx-auto hover:scale-105 shadow-lg shadow-purple-500/20"
                >
                  <Upload size={18} />
                  Upload
                </button>
              </div>
            )}
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Max file size: 10MB per photo</p>
          </div>
        </section>

        <div className="pt-8">
          <button 
            type="submit"
            disabled={isSubmitting || isSubmitted || selectedServices.length === 0}
            className={cn(
              "w-full py-5 rounded-[2rem] font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed",
              isSubmitted 
                ? "bg-slate-900 text-white shadow-slate-900/30" 
                : "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-900/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70"
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={24} />
                <span>Submitting...</span>
              </div>
            ) : isSubmitted ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={24} />
                <span>Project Submitted</span>
              </div>
            ) : (
              <>
                <span>Submit Project Request</span>
                <ArrowRight size={24} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
