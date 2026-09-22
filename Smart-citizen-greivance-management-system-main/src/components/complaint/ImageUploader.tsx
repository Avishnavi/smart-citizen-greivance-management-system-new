import React, { useRef, useState } from 'react';
import { Camera, X, Plus, Sparkles } from 'lucide-react';

interface ImageUploaderProps {
  imageUrls: string[];
  onImagesChange: (urls: string[]) => void;
  maxImages?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageUrls,
  onImagesChange,
  maxImages = 4
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sampleCivicPhotos = [
    {
      label: 'Pothole',
      url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80'
    },
    {
      label: 'Sewage Overflow',
      url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80'
    },
    {
      label: 'Streetlight',
      url: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80'
    },
    {
      label: 'Garbage Dump',
      url: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=600&q=80'
    }
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (imageUrls.length + newUrls.length >= maxImages) break;
      const file = files[i];
      const url = URL.createObjectURL(file);
      newUrls.push(url);
    }

    onImagesChange([...imageUrls, ...newUrls]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files) return;

    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (imageUrls.length + newUrls.length >= maxImages) break;
      const file = files[i];
      const url = URL.createObjectURL(file);
      newUrls.push(url);
    }
    onImagesChange([...imageUrls, ...newUrls]);
  };

  const removeImage = (index: number) => {
    const updated = imageUrls.filter((_, idx) => idx !== index);
    onImagesChange(updated);
  };

  const addSampleImage = (url: string) => {
    if (imageUrls.length >= maxImages) return;
    if (!imageUrls.includes(url)) {
      onImagesChange([...imageUrls, url]);
    }
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Photo Attachments</h4>
            <p className="text-[11px] text-slate-500">
              Upload photos of the problem ({imageUrls.length}/{maxImages})
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {imageUrls.map((url, idx) => (
          <div
            key={idx}
            className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video sm:aspect-square bg-slate-100 shadow-xs"
          >
            <img
              src={url}
              alt={`Evidence ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
            />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition opacity-90 group-hover:opacity-100"
              title="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="absolute bottom-1 left-1.5 text-[10px] font-semibold bg-black/50 text-white px-1.5 py-0.5 rounded backdrop-blur-xs">
              Photo {idx + 1}
            </span>
          </div>
        ))}

        {imageUrls.length < maxImages && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition aspect-video sm:aspect-square ${
              isDragging
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-300 hover:border-sky-400 bg-white hover:bg-sky-50/40'
            }`}
          >
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl mb-1 group-hover:scale-110 transition">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Add Photo</span>
            <span className="text-[10px] text-slate-400">Click or drag & drop</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-200/70">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Quick sample civic photos for demo:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sampleCivicPhotos.map((sample, i) => (
            <button
              key={i}
              type="button"
              onClick={() => addSampleImage(sample.url)}
              disabled={imageUrls.includes(sample.url) || imageUrls.length >= maxImages}
              className="text-[11px] px-2 py-1 bg-white hover:bg-sky-50 border border-slate-200 rounded-lg text-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + {sample.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
