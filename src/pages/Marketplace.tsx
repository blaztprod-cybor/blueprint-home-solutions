import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Zap, Leaf, Home, Thermometer } from 'lucide-react';

const projectCategories = [
  { id: 'roofs', name: 'Roofs', icon: '🏠' },
  { id: 'bathrooms', name: 'Bathrooms', icon: '🚿' },
  { id: 'kitchens', name: 'Kitchens', icon: '🍳' },
  { id: 'basements', name: 'Basements', icon: '🧱' },
  { id: 'windows', name: 'Windows', icon: '🪟' },
  { id: 'fencing', name: 'Fencing', icon: '🚧' },
  { id: 'brickwork', name: 'Brick Work', icon: '🧱' },
  { id: 'floors', name: 'Floors', icon: '🪵' },
];

const serviceOptions = [
  {
    id: 'compliance',
    title: 'Code Compliance',
    description: 'Correct violations and bring older homes back into code.',
    icon: ShieldCheck,
    color: 'bg-blue-50 text-blue-600 border-blue-100'
  },
  {
    id: 'senior',
    title: 'Senior Services',
    description: 'Accessibility-focused repairs and support for aging in place.',
    icon: Users,
    color: 'bg-purple-50 text-purple-600 border-purple-100'
  },
  {
    id: 'energy',
    title: 'Energy Efficiency',
    description: 'Weatherization, insulation, and energy-saving upgrades.',
    icon: Zap,
    color: 'bg-amber-50 text-amber-600 border-amber-100'
  },
  {
    id: 'environmental',
    title: 'Environmental',
    description: 'Lead hazard remediation and healthy-home work.',
    icon: Leaf,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  },
  {
    id: 'hvac',
    title: 'HVAC',
    description: 'Heating and cooling system installation or repair.',
    icon: Thermometer,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-100'
  },
  {
    id: 'windows',
    title: 'Windows',
    description: 'Window replacements and weather-tight upgrades.',
    icon: Home,
    color: 'bg-slate-50 text-slate-600 border-slate-100'
  }
];

export default function Marketplace() {
  const navigate = useNavigate();

  const handleCategoryStart = (catId: string) => {
    navigate('/start-project', { state: { category: catId } });
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground mt-1 font-medium">Start a project and connect with the right home pros.</p>
        </div>
      </div>

      <section className="space-y-8">
        <h2 className="text-2xl font-bold tracking-tight">Pick a category to start a new project</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {projectCategories.map((cat) => (
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
      </section>

      <section className="space-y-8">
        <h2 className="text-2xl font-bold tracking-tight">More ways Blueprint can help</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {serviceOptions.map((service) => (
            <button
              key={service.id}
              onClick={() => handleCategoryStart(service.id)}
              className="group bg-white rounded-3xl border border-slate-200 p-6 text-left hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${service.color}`}>
                <service.icon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                {service.title}
              </h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                {service.description}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
