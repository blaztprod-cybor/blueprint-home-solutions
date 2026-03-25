import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Hammer, 
  Search, 
  ChevronRight, 
  Star,
  Clock,
  MapPin,
  ArrowRight,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';

const categories = [
  { id: 'roofs', name: 'Roofs', icon: '🏠', color: 'bg-blue-50 text-blue-600' },
  { id: 'bathrooms', name: 'Bathrooms', icon: '🚿', color: 'bg-cyan-50 text-cyan-600' },
  { id: 'kitchens', name: 'Kitchens', icon: '🍳', color: 'bg-orange-50 text-orange-600' },
  { id: 'basements', name: 'Basements', icon: '🧱', color: 'bg-slate-50 text-slate-600' },
  { id: 'windows', name: 'Windows', icon: '🪟', color: 'bg-indigo-50 text-indigo-600' },
  { id: 'fencing', name: 'Fencing', icon: '🚧', color: 'bg-emerald-50 text-emerald-600' },
  { id: 'brickwork', name: 'Brick Work', icon: '🧱', color: 'bg-rose-50 text-rose-600' },
  { id: 'floors', name: 'Floors', icon: '🪵', color: 'bg-amber-50 text-amber-600' },
];

export default function Marketplace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHomeowner = user?.role === 'Homeowner';

  const handleCategoryStart = (catId: string) => {
    navigate('/start-project', { state: { category: catId } });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground mt-1 font-medium">Find the best home pros for your project</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Pick a category to start a New project</h2>
          <Link to="/services" className="text-sm font-bold text-primary flex items-center gap-1 hover:underline">
            View All <ChevronRight size={16} />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((cat) => (
            <button 
              key={cat.id}
              onClick={() => handleCategoryStart(cat.id)}
              className="flex flex-col items-center justify-center p-6 rounded-2xl border transition-all group bg-white border-slate-100 hover:border-primary/30 hover:shadow-md"
            >
              <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">{cat.icon}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-center">{cat.name}</span>
            </button>

          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 mt-12">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Recent Job Postings</h2>
          <div className="bg-white p-12 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
              <Search size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No active job postings</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">New projects will appear here as homeowners post them in your service area.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
