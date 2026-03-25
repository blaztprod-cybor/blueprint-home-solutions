import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Zap, 
  Leaf, 
  Home, 
  Thermometer,
  ChevronRight,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';

const services = [
  {
    title: "Code Compliance",
    description: "Correcting violations, particularly for older or subsidized homes.",
    icon: ShieldCheck,
    color: "bg-blue-50 text-blue-600 border-blue-100",
    details: "Ensure your home meets all local building codes and safety regulations. We specialize in resolving DOB and HPD violations."
  },
  {
    title: "Senior Services",
    description: "Special assistance programs, such as for senior home repairs.",
    icon: Users,
    color: "bg-purple-50 text-purple-600 border-purple-100",
    details: "Dedicated support for aging-in-place modifications and essential maintenance for senior homeowners."
  },
  {
    title: "Energy Efficiency",
    description: "Adding insulation, upgrading windows, and installing high-efficiency appliances.",
    icon: Zap,
    color: "bg-amber-50 text-amber-600 border-amber-100",
    details: "Reduce your utility bills and carbon footprint with modern energy-saving solutions and weatherization."
  },
  {
    title: "Environmental",
    description: "Lead hazard remediation and rodent control.",
    icon: Leaf,
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    details: "Protect your family from environmental hazards including lead-based paint and pest infestations."
  },
  {
    title: "Exterior Improvements",
    description: "Pool remodeling, landscaping, fencing, and deck construction.",
    icon: Home,
    color: "bg-slate-50 text-slate-600 border-slate-100",
    details: "Enhance your home's curb appeal and outdoor living space with professional exterior renovations."
  },
  {
    title: "HVAC",
    description: "Installing or repairing air conditioning and heating systems.",
    icon: Thermometer,
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
    details: "Maintain year-round comfort with expert installation and maintenance of heating and cooling systems."
  }
];

export default function Services() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      <div className="max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight">Homeowner Services</h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Comprehensive solutions and assistance programs tailored for your home's needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border transition-transform group-hover:scale-110",
              service.color
            )}>
              <service.icon size={24} />
            </div>
            
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              {service.title}
            </h3>
            <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
              {service.description}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {service.details}
            </p>
            
            <button className="flex items-center gap-2 text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 uppercase tracking-widest group-hover:gap-3 transition-all">
              Learn More
              <ArrowRight size={14} className="text-blue-600" />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="pt-8 border-t border-slate-100">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
