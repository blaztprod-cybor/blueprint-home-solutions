import React, { useState } from 'react';
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
  Loader2,
  User as UserIcon,
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { projectCategories as services } from '../data/projectCategories';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s./-]*\d{3}[\s./-]*\d{4}\b/;
const DIGIT_WORDS = new Set(['zero', 'oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']);

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
      if (consecutiveDigitWords >= 7) return true;
    } else {
      consecutiveDigitWords = 0;
    }
  }

  return false;
};

export default function StartProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const routeCategory =
    typeof location.state?.category === 'string'
      ? location.state.category
      : searchParams.get('category') || '';
  const selectedCategoryId = services.some((service) => service.id === routeCategory) ? routeCategory : '';
  const selectedService = services.find((service) => service.id === selectedCategoryId) ?? null;

  const [formData, setFormData] = useState({
    name: '',
    street: '',
    town: '',
    zip: '',
    phone: '',
    email: '',
    startDate: '',
    description: '',
  });
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedPhotos((prev) => [...prev, ...files].slice(0, 10));
    }
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCategoryId) {
      alert('Select an improvement category first.');
      return;
    }

    if (containsBlockedContactInfo(formData.description)) {
      setDescriptionError('Please remove phone numbers and email addresses from the project description.');
      return;
    }

    setIsSubmitting(true);

    try {
      const photoBase64s = await Promise.all(
        selectedPhotos.map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            })
        )
      );

      const createdAt = new Date().toISOString();
      const leadRef = doc(collection(db, 'leads'));

      await setDoc(leadRef, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        category: selectedService?.title || 'General',
        description: formData.description.trim(),
        startDate: formData.startDate,
        status: 'New Lead',
        location: {
          street: formData.street.trim(),
          town: formData.town.trim(),
          zip: formData.zip.trim(),
        },
        photoCount: selectedPhotos.length,
        photos: photoBase64s.slice(0, 3),
        createdAt,
      });

      await setDoc(doc(db, 'lead_marketplace', leadRef.id), {
        leadId: leadRef.id,
        category: selectedService?.title || 'General',
        description: formData.description.trim(),
        status: 'Open',
        location: {
          town: formData.town.trim(),
          zip: formData.zip.trim(),
        },
        photoCount: selectedPhotos.length,
        photos: photoBase64s.slice(0, 3),
        createdAt,
      });

      setIsSubmitted(true);
      navigate('/thank-you');
    } catch (error) {
      console.error('Error creating lead:', error);
      handleFirestoreError(error, OperationType.WRITE, 'leads');
      alert('Failed to submit request. Please try again.');
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
        <h1 className="text-xl font-bold text-slate-900">Request Service</h1>
        <div className="w-10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-primary/15 bg-primary/5 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Selected Improvement</p>
            <div className="mt-3">
              {selectedService ? (
                <h2 className="text-2xl font-black tracking-tight text-slate-950">{selectedService.title}</h2>
              ) : (
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Select an improvement first</h2>
                  <p className="text-sm font-medium text-slate-600">Go back and choose a category to start the request form.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <ArrowRight size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Describe The Project</h2>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Project Description</label>
            <textarea
              required
              placeholder="Briefly describe the project..."
              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium min-h-[120px]"
              value={formData.description}
              onChange={(e) => {
                const nextValue = e.target.value;
                setFormData({ ...formData, description: nextValue });
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
            {descriptionError && <p className="text-sm font-bold text-red-600">{descriptionError}</p>}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <UserIcon size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Contact Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Name</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Email</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Project Location</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Street Address</label>
              <input
                required
                type="text"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Town / City</label>
              <input
                required
                type="text"
                value={formData.town}
                onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Zip Code</label>
              <input
                required
                type="text"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Timeline</h2>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Projected Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                required
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Camera size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Photos</h2>
          </div>
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-8 md:p-12 text-center space-y-6 hover:border-primary/30 transition-colors group">
            <input type="file" ref={fileInputRef} onChange={handlePhotoChange} multiple accept="image/*" className="hidden" />

            {selectedPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {selectedPhotos.map((file, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden group/photo">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
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
                <p className="font-bold text-slate-900">Add up to 10 photos</p>
                <button
                  type="button"
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
            disabled={isSubmitting || isSubmitted || !selectedCategoryId}
            className={cn(
              'w-full py-5 rounded-[2rem] font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed',
              isSubmitted
                ? 'bg-slate-900 text-white shadow-slate-900/30'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-900/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70'
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
                <span>Request Submitted</span>
              </div>
            ) : (
              <>
                <span>Submit Request</span>
                <ArrowRight size={24} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
