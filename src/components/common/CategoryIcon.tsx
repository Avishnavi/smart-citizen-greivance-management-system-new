import React from 'react';
import type { ComplaintCategory } from '../../types';
import {
  AlertTriangle,
  Droplet,
  Waves,
  Lightbulb,
  Trash2,
  Car,
  Dog,
  Trees,
  Building2,
  Volume2,
  HelpCircle
} from 'lucide-react';

interface CategoryIconProps {
  category: ComplaintCategory;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-5 h-5'
}) => {
  switch (category) {
    case 'Pothole':
      return <AlertTriangle className={`${className} text-amber-600`} />;
    case 'Water Supply':
      return <Droplet className={`${className} text-sky-600`} />;
    case 'Drainage':
      return <Waves className={`${className} text-indigo-600`} />;
    case 'Streetlight':
      return <Lightbulb className={`${className} text-yellow-600`} />;
    case 'Garbage':
      return <Trash2 className={`${className} text-emerald-600`} />;
    case 'Traffic':
      return <Car className={`${className} text-orange-600`} />;
    case 'Stray Animals':
      return <Dog className={`${className} text-amber-700`} />;
    case 'Tree Fall':
      return <Trees className={`${className} text-green-600`} />;
    case 'Illegal Construction':
      return <Building2 className={`${className} text-red-600`} />;
    case 'Air & Noise':
      return <Volume2 className={`${className} text-purple-600`} />;
    case 'Other':
    default:
      return <HelpCircle className={`${className} text-slate-600`} />;
  }
};
