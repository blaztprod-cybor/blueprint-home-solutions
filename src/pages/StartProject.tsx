import React, { useEffect, useState } from 'react';
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
import { db, handleFirestoreError, OperationType, uploadFilesToStorage } from '../firebase';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { projectCategories as services } from '../data/projectCategories';
import { useAuth } from '../AuthContext';

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

const SUBMIT_TIMEOUT_MS = 15000;

function getSubmissionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('timed out')) {
      return 'Photo upload timed out. Try one photo first or submit without photos, then add them after the project is created.';
    }
    if (error.message.includes('permission-denied')) {
      return 'Submission was blocked by Firestore permissions. Refresh the app and try again.';
    }
    if (error.message.includes('unavailable') || error.message.includes('network')) {
      return 'Network issue while submitting. Check your connection and try again.';
    }
    if (error.message.includes('deadline-exceeded') || error.message.includes('timed out')) {
      return 'Submission took too long. Please try again without photos first.';
    }
  }

  return 'Failed to submit request. Please try again without photos first.';
}

export default function StartProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, updateProfile } = useAuth();

  const routeCategory =
    typeof location.state?.category === 'string'
      ? location.state.category
      : searchParams.get('category') || '';
  const selectedCategoryId = services.some((service) => service.id === routeCategory) ? routeCategory : '';
  const selectedService = services.find((service) => service.id === selectedCategoryId) ?? null;
  const isLoggedInHomeowner = user?.role === 'Homeowner';
  const backTarget = isLoggedInHomeowner ? '/homeowner-dashboard' : '/select-improvement';

  const [formData, setFormData] = useState({
    name: user?.name || '',
    street: '',
    town: '',
    zip: '',
    phone: '',
    email: user?.email || '',
    startDate: '',
    description: '',
  });
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isLoadingSavedDetails, setIsLoadingSavedDetails] = useState(false);
  const [hasPrefilledHomeownerDetails, setHasPrefilledHomeownerDetails] = useState(false);
  const [isEditingSavedDetails, setIsEditingSavedDetails] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const hasSavedHomeownerDetails =
    !!formData.name.trim() &&
    !!formData.email.trim() &&
    !!formData.phone.trim() &&
    !!formData.town.trim() &&
    !!formData.zip.trim();
  const shouldUseSavedDetails = isLoggedInHomeowner && hasPrefilledHomeownerDetails;
  const showContactEditor = !shouldUseSavedDetails || isEditingSavedDetails;

  useEffect(() => {
    if (!user || user.role !== 'Homeowner') return;

    const nextData = {
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      street: user.street || '',
      town: user.town || '',
      zip: user.zip || '',
    };

    setFormData((current) => ({
      ...current,
      name: current.name || nextData.name,
      email: current.email || nextData.email,
      phone: current.phone || nextData.phone,
      street: current.street || nextData.street,
      town: current.town || nextData.town,
      zip: current.zip || nextData.zip,
    }));

    if (nextData.name && nextData.email && nextData.phone && nextData.town && nextData.zip) {
      setHasPrefilledHomeownerDetails(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'Homeowner') return;

    let isMounted = true;

    const loadSavedDetails = async () => {
      setIsLoadingSavedDetails(true);
      try {
        const snapshot = await getDocs(query(collection(db, 'projects'), where('uid', '==', user.id)));
        const latestProject = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .sort((a, b) => new Date(String(b.createdAt || '')).getTime() - new Date(String(a.createdAt || '')).getTime())[0] as
          | {
              phone?: string;
              location?: { street?: string; town?: string; zip?: string };
            }
          | undefined;

        if (!isMounted || !latestProject) return;

        const nextData = {
          phone: latestProject.phone || user.phone || '',
          street: latestProject.location?.street || user.street || '',
          town: latestProject.location?.town || user.town || '',
          zip: latestProject.location?.zip || user.zip || '',
        };

        setFormData((current) => ({
          ...current,
          phone: current.phone || nextData.phone,
          street: current.street || nextData.street,
          town: current.town || nextData.town,
          zip: current.zip || nextData.zip,
        }));

        if ((user.name || '') && (user.email || '') && nextData.phone && nextData.town && nextData.zip) {
          setHasPrefilledHomeownerDetails(true);
        }
      } catch (error) {
        console.error('[StartProject] Failed to load saved homeowner details:', error);
      } finally {
        if (isMounted) {
          setIsLoadingSavedDetails(false);
        }
      }
    };

    void loadSavedDetails();

    return () => {
      isMounted = false;
    };
  }, [user]);

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

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.town.trim() || !formData.zip.trim()) {
      setSubmitError('Please complete your saved contact details once before submitting.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const createdAt = new Date().toISOString();
      const description = formData.description.trim();
      const leadRef = doc(collection(db, 'leads'));
      const marketplaceRef = doc(db, 'lead_marketplace', leadRef.id);
      const projectRef = user ? doc(db, 'projects', leadRef.id) : null;
      const batch = writeBatch(db);
      const photoStoragePath = projectRef ? `projects/${leadRef.id}/photos` : `leads/${leadRef.id}`;
      let uploadedPhotoUrls: string[] = [];
      let photoUploadIssue = false;

      if (selectedPhotos.length) {
        try {
          uploadedPhotoUrls = await uploadFilesToStorage(selectedPhotos, photoStoragePath);
        } catch (error) {
          photoUploadIssue = true;
          console.error('[StartProject] Photo upload failed, continuing without photos:', error);
        }
      }
      const projectPhotosPreview = uploadedPhotoUrls.slice(0, 3);

      batch.set(leadRef, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        category: selectedService?.title || 'General',
        description,
        startDate: formData.startDate,
        status: 'New Lead',
        location: {
          street: formData.street.trim(),
          town: formData.town.trim(),
          zip: formData.zip.trim(),
        },
        photoCount: uploadedPhotoUrls.length,
        photos: projectPhotosPreview,
        createdAt,
      });

      batch.set(marketplaceRef, {
        leadId: leadRef.id,
        category: selectedService?.title || 'General',
        description,
        status: 'Open',
        location: {
          town: formData.town.trim(),
          zip: formData.zip.trim(),
        },
        photoCount: uploadedPhotoUrls.length,
        photos: projectPhotosPreview,
        createdAt,
      });

      if (projectRef) {
        batch.set(projectRef, {
          uid: user.id,
          title: selectedService?.title || 'General Project',
          description,
          status: 'New Open Project',
          budget: 0,
          startDate: formData.startDate,
          category: selectedService?.title || 'General',
          phone: formData.phone.trim(),
          location: {
            street: formData.street.trim(),
            town: formData.town.trim(),
            zip: formData.zip.trim(),
          },
          photoCount: uploadedPhotoUrls.length,
          photos: projectPhotosPreview,
          services: selectedService ? [selectedService.title] : ['General'],
          createdAt,
          updatedAt: createdAt,
        });

        uploadedPhotoUrls.forEach((url, index) => {
          const photoRef = doc(collection(db, 'projects', projectRef.id, 'photos'));
          batch.set(photoRef, {
            url,
            createdAt: new Date(Date.now() + index).toISOString(),
            uid: user.id,
          });
        });
      }

      await Promise.race([
        batch.commit(),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('timed out')), SUBMIT_TIMEOUT_MS);
        }),
      ]);

      if (user?.role === 'Homeowner') {
        try {
          await updateProfile({
            phone: formData.phone.trim(),
            street: formData.street.trim(),
            town: formData.town.trim(),
            zip: formData.zip.trim(),
          });
        } catch (error) {
          console.error('[StartProject] Failed to save homeowner details:', error);
        }
      }

      navigate('/thank-you', {
        state: projectRef
          ? {
              projectId: projectRef.id,
              projectSubmitted: true,
              photoUploadIssue,
            }
          : { photoUploadIssue },
      });

      void (async () => {
        try {
          const confirmationResponse = await fetch('/api/send-project-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim(),
            name: formData.name.trim(),
            projectTitle: selectedService?.title || 'General',
            startDate: formData.startDate,
            description,
            photos: projectPhotosPreview,
          }),
          });

          if (!confirmationResponse.ok) {
            const payload = await confirmationResponse.json().catch(() => null);
            console.error('Project confirmation email failed:', payload?.error || confirmationResponse.statusText);
          }
        } catch (emailError) {
          console.error('Project confirmation email request failed:', emailError);
        }
      })();
    } catch (error) {
      console.error('Error creating lead:', error);
      try {
        handleFirestoreError(error, OperationType.WRITE, 'leads');
      } catch (loggedError) {
        console.error('Lead submission logging error:', loggedError);
      }
      setSubmitError(getSubmissionErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(backTarget)}
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
          {submitError && <p className="text-sm font-bold text-red-600">{submitError}</p>}
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
          {shouldUseSavedDetails && !isEditingSavedDetails ? (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Saved Account Details</p>
                  <p className="text-lg font-black text-slate-900">{formData.name}</p>
                  <p className="text-sm font-medium text-slate-600">{formData.email}</p>
                  <p className="text-sm font-medium text-slate-600">{formData.phone}</p>
                  <p className="text-sm font-medium text-slate-600">
                    {[formData.street, formData.town, formData.zip].filter(Boolean).join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingSavedDetails(true)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Change Contact Information
                </button>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoadingSavedDetails && isLoggedInHomeowner && (
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                Loading your saved homeowner details...
              </div>
            )}
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
          )}
        </section>

        {showContactEditor && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <MapPin size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Project Location</h2>
            </div>
            {shouldUseSavedDetails && isEditingSavedDetails && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditingSavedDetails(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Use Saved Details
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Street Address</label>
                <input
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
        )}

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
            disabled={isSubmitting || !selectedCategoryId}
            className={cn(
              'w-full py-5 rounded-[2rem] font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed',
              'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-900/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70'
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={24} />
                <span>Submitting...</span>
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
