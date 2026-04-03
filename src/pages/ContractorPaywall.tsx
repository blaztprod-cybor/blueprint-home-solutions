import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

const plans = [
  {
    name: 'Two Weeks Free',
    price: 'Free',
    term: '14 days',
    description: 'Full Marketplace access and 5 boroughs of recently filed DOB permits all categories.',
    ctaLabel: 'Start Free Trial',
    ctaLink: '/signup?role=contractor',
    isActive: true,
  },
  {
    name: 'Beginner',
    price: '$149',
    term: 'per month',
    description: 'Full Marketplace Access & One Borough of Recently Filed DOB Permits all categories.',
    ctaLabel: 'Coming Soon',
    isActive: false,
  },
  {
    name: 'Junior',
    price: '$249',
    term: 'per month',
    description: 'Full Marketplace Access & Two Boroughs of Recently Filed DOB Permits all categories.',
    ctaLabel: 'Coming Soon',
    isActive: false,
  },
  {
    name: 'Pro',
    price: '$449',
    term: 'per month',
    description: 'Full Marketplace Access & Five Boroughs of Recently Filed DOB Permits all categories.',
    ctaLabel: 'Coming Soon',
    isActive: false,
  }
];

export default function ContractorPaywall() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <style>{`
        @keyframes blueprint-pan {
          0% { transform: scale(1.12) translateX(-2%); }
          50% { transform: scale(1.12) translateX(2%); }
          100% { transform: scale(1.12) translateX(-2%); }
        }
      `}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{
          backgroundImage: "url('/home-pro-trial-bg.jpg')",
          animation: 'blueprint-pan 24s ease-in-out infinite',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-white/78" />

      <div className="relative mx-auto max-w-6xl space-y-12">
        <div className="flex items-start justify-center gap-4">
          <Link to="/" className="flex flex-col items-center">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-28 w-auto rounded-3xl object-contain" />
          </Link>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Lock size={30} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Billing and Subscriptions</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-7 text-slate-600">
            Choose the access level that fits your business
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                <span className="pb-1 text-sm font-bold text-slate-400">{plan.term}</span>
              </div>
              <p className="mt-4 text-sm font-medium leading-6 text-slate-600">{plan.description}</p>
              {plan.isActive ? (
                <Link
                  to={plan.ctaLink}
                  className="mt-8 block w-full rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {plan.ctaLabel}
                </Link>
              ) : (
                <div className="mt-8 w-full rounded-2xl border border-slate-200 bg-slate-100 px-6 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  {plan.ctaLabel}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
