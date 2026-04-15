import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Image as ImageIcon, Loader2, Trash2, X } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function PortfolioGallery() {
  const { user, updateProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewerImage, setViewerImage] = useState<{ src: string; label: string } | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<string[]>(user?.portfolioImages || []);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPortfolioImages(user?.portfolioImages || []);
  }, [user?.portfolioImages]);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 1400;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
    });
  };

  const persistPortfolio = async (nextImages: string[]) => {
    setIsSaving(true);
    setError('');
    try {
      await updateProfile({ portfolioImages: nextImages });
      setPortfolioImages(nextImages);
    } catch (portfolioError: any) {
      setError(portfolioError.message || 'Failed to update portfolio gallery.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePortfolioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const availableSlots = Math.max(0, 6 - portfolioImages.length);
    const acceptedFiles = files.slice(0, availableSlots);

    if (acceptedFiles.length === 0) {
      setError('Portfolio is limited to 6 images.');
      return;
    }

    try {
      const nextImages = await Promise.all(
        acceptedFiles.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              if (file.size > 5 * 1024 * 1024) {
                reject(new Error(`${file.name} exceeds 5MB`));
                return;
              }

              const reader = new FileReader();
              reader.onloadend = async () => {
                try {
                  const compressed = await compressImage(reader.result as string);
                  resolve(compressed);
                } catch (compressionError) {
                  reject(compressionError);
                }
              };
              reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
              reader.readAsDataURL(file);
            })
        )
      );

      await persistPortfolio([...portfolioImages, ...nextImages].slice(0, 6));
    } catch (portfolioError: any) {
      setError(portfolioError.message || 'Failed to add portfolio images');
    } finally {
      e.target.value = '';
    }
  };

  const removePortfolioImage = async (index: number) => {
    await persistPortfolio(portfolioImages.filter((_, imageIndex) => imageIndex !== index));
  };

  if (!user || user.role !== 'Contractor') {
    return null;
  }

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {viewerImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8"
          >
            <div className="w-full max-w-4xl rounded-[28px] bg-white p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">{viewerImage.label}</h2>
                <button
                  onClick={() => setViewerImage(null)}
                  className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Close image viewer"
                >
                  <X size={18} />
                </button>
              </div>
              <img
                src={viewerImage.src}
                alt={viewerImage.label}
                className="max-h-[75vh] w-full rounded-2xl border border-slate-200 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Contractor Portfolio</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Past Work Gallery</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Upload finished jobs to help homeowners evaluate your work before they accept an estimate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => portfolioInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.02]"
          >
            <Camera size={18} />
            Add Work Photos
          </button>
          <input
            ref={portfolioInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handlePortfolioChange}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {portfolioImages.length} of 6 images used
          </p>
          {isSaving && (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <Loader2 className="animate-spin" size={14} />
              Saving
            </div>
          )}
        </div>

        {portfolioImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {portfolioImages.map((image, index) => (
              <div key={`${image}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img
                  src={image}
                  alt={`Portfolio example ${index + 1}`}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-slate-950/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setViewerImage({ src: image, label: `Past Work ${index + 1}` })}
                    className="rounded-xl bg-white/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-800"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePortfolioImage(index)}
                    className="rounded-xl bg-rose-500/90 px-3 py-2 text-white"
                    aria-label={`Remove portfolio image ${index + 1}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
            <ImageIcon size={28} className="mx-auto text-slate-300" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              No past work images uploaded yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
