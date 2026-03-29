import { useNavigate } from 'react-router-dom';
import { projectCategories } from '../data/projectCategories';

export default function Marketplace() {
  const navigate = useNavigate();

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
            <div
              key={category.id}
              className="group w-[122px] text-left"
            >
              <div className="space-y-3">
                <div className="relative h-32 overflow-hidden rounded-[1.2rem]">
                  <div
                    className="absolute inset-0 bg-cover bg-center brightness-[1.14] saturate-[1.18] contrast-[1.04]"
                    style={{
                      backgroundImage: `url('${category.image}')`,
                      backgroundPosition: category.imagePosition ?? 'center',
                    }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(15,23,42,0.06)_40%,rgba(15,23,42,0.18)_100%)]" />
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/start-project?category=${encodeURIComponent(category.id)}`, { state: { category: category.id } })}
                  className="w-full rounded-xl bg-primary px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white"
                >
                    Select
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
