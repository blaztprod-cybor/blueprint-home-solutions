import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { projectCategories } from '../data/projectCategories';

export default function SelectImprovement() {
  const topRowCategories = projectCategories.slice(0, 8);
  const bottomRowCategories = projectCategories.slice(8, 16);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-10 md:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.14]"
          style={{ backgroundImage: "url('/logo.jpg')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.92)_0%,rgba(248,250,252,0.9)_35%,rgba(248,250,252,0.96)_100%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/homeowner-dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
          >
            <ChevronLeft size={18} />
            My Account
          </Link>
          <div className="w-24" />
        </div>

        <div className="text-center">
          <p className="mx-auto max-w-3xl text-xl font-black tracking-tight text-slate-900 md:text-3xl">
            Select the category that fits your project
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-8">
          <div className="space-y-5">
            {[topRowCategories, bottomRowCategories].map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-2 justify-center gap-4 sm:grid-cols-4 lg:grid-cols-8">
                {row.map((category) => (
                  <Link
                    key={category.id}
                    to={`/start-project?category=${encodeURIComponent(category.id)}`}
                    className="group space-y-3"
                    aria-label={`Select ${category.title}`}
                  >
                    <div className="relative h-28 overflow-hidden rounded-[1.35rem]">
                      <div
                        className="absolute inset-0 bg-cover bg-center brightness-[1.12] saturate-[1.12]"
                        style={{ backgroundImage: `url('${category.image}')`, backgroundPosition: category.imagePosition ?? 'center' }}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(15,23,42,0.08)_38%,rgba(15,23,42,0.22)_100%)] transition-colors group-hover:bg-[linear-gradient(180deg,rgba(37,99,235,0.06)_0%,rgba(124,58,237,0.1)_48%,rgba(15,23,42,0.28)_100%)]" />
                      <div className="absolute inset-0 rounded-[1.35rem] border border-white/20" />
                    </div>
                    <p className="truncate text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 md:text-[11px]">
                      {category.title}
                    </p>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
