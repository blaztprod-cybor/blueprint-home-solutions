import { useNavigate } from 'react-router-dom';
import { projectCategories } from '../data/projectCategories';

export default function Marketplace() {
  const navigate = useNavigate();

  const handleCategoryStart = (category: string) => {
    navigate('/start-project', { state: { category } });
  };

  return (
    <div className="space-y-10">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-black tracking-tight">Homeowner Portal</h1>
        <p className="text-3xl font-black tracking-tight text-slate-700">
          Pick a category to start a new project
        </p>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap justify-center gap-3">
          {projectCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryStart(category.id)}
              className="group w-[122px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-xl shadow-slate-200/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/70"
            >
              <div className="relative h-32 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center brightness-[1.14] saturate-[1.18] contrast-[1.04] transition-transform duration-500 group-hover:scale-110"
                  style={{
                    backgroundImage: `url('${category.image}')`,
                    backgroundPosition: category.imagePosition ?? 'center',
                  }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(15,23,42,0.06)_40%,rgba(15,23,42,0.18)_100%)]" />
              </div>
              <div className="space-y-1 px-3 py-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                  {category.title}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  Describe Project
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
