import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Lock, Store } from 'lucide-react';
import { useAuth } from '../AuthContext';

const marketplacePlans = [
  {
    name: 'Marketplace Weekly',
    price: '$15',
    term: 'per week',
    description: 'A simple homeowner lead solution for small trades and single-operator pros.',
  },
  {
    name: 'Marketplace Monthly',
    price: '$25',
    term: 'per month',
    description: 'Low-cost access to the marketplace for pros who want steady homeowner opportunity flow.',
  },
  {
    name: 'Marketplace Yearly',
    price: '$100',
    term: 'per year',
    description: 'Best long-term value for small businesses using Blueprint as a steady local lead source.',
  },
];

const intelligencePlans = [
  {
    name: 'DOB Lead Flow 1 Borough',
    price: '$100',
    term: 'per month',
    description: 'DOB and API intelligence access across one borough for focused filing and project exploration.',
  },
  {
    name: 'DOB Lead Flow 3 Boroughs',
    price: '$300',
    term: 'per month',
    description: 'Broader borough coverage for firms that want more filings, more project depth, and more lead flow.',
  },
  {
    name: 'DOB Lead Flow 5 Boroughs',
    price: '$500',
    term: 'per month',
    description: 'Full five-borough intelligence access for teams using Blueprint as a serious project discovery engine.',
  },
];

function PlanCard({
  name,
  price,
  term,
  description,
  tone,
}: {
  name: string;
  price: string;
  term: string;
  description: string;
  tone: 'marketplace' | 'intelligence';
}) {
  const tones =
    tone === 'marketplace'
      ? {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          button: 'from-emerald-600 to-lime-500 shadow-emerald-500/20',
        }
      : {
          badge: 'bg-sky-50 text-sky-700 border-sky-100',
          button: 'from-sky-600 to-cyan-500 shadow-sky-500/20',
        };

  return (
    <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-xl shadow-stone-200/50">
      <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tones.badge}`}>
        {tone === 'marketplace' ? 'Homeowner Lead Flow' : 'DOB Lead Flow'}
      </div>
      <p className="mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">{name}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-4xl font-black tracking-tight text-stone-900">{price}</span>
        <span className="pb-1 text-sm font-bold text-stone-400">{term}</span>
      </div>
      <p className="mt-4 text-sm font-medium leading-6 text-stone-600">{description}</p>
      <button
        type="button"
        className={`mt-8 w-full rounded-2xl bg-gradient-to-r ${tones.button} px-6 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-transform hover:scale-[1.01]`}
      >
        Select Plan
      </button>
    </article>
  );
}

export default function ContractorPaywall() {
  const { user } = useAuth();
  const contractorProfileComplete =
    user?.role !== 'Contractor' ||
    (
      !!user.avatar &&
      !user.avatar.startsWith('data:image/svg+xml') &&
      !!user.phone?.trim() &&
      !!user.street?.trim() &&
      !!user.town?.trim() &&
      !!user.zip?.trim() &&
      !!user.governmentIdImage?.trim() &&
      (user.isTradesman ? !!user.trade?.trim() : !!user.licenseNumber?.trim())
    );

  const portalLink =
    user?.role === 'Contractor'
      ? (contractorProfileComplete ? '/projects' : '/settings')
      : '/signup?role=contractor';

  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 scale-[1.08] bg-cover bg-center opacity-[0.14]"
          style={{ backgroundImage: "url('/home-pro-trial-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,rgba(250,250,249,0.92),rgba(250,250,249,0.98))]" />
      </div>

      <div className="relative mx-auto max-w-[96rem] space-y-10">
        <div className="flex justify-center">
          <Link to="/" className="inline-flex flex-col items-center">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-28 w-auto rounded-3xl object-contain" />
          </Link>
        </div>

        <section className="rounded-[2.5rem] border border-stone-200 bg-white/92 p-8 shadow-2xl shadow-stone-200/60 sm:p-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-stone-600">
              <Lock size={14} />
              Home Pro Subscriptions
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-stone-900 sm:text-5xl">
              A lead solution to fit your business.
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-7 text-stone-600">
              Choose a simple homeowner lead flow plan, or move up to DOB lead flow for borough-based filing and pipeline discovery.
            </p>
            <Link
              to={portalLink}
              className="mx-auto mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-black transition-transform hover:scale-[1.01]"
            >
              Start 30-Day Free Trial With Full Access
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
              <Store size={24} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">Homeowner Lead Flow</p>
              <h2 className="text-2xl font-black tracking-tight text-stone-900">Homeowner Lead Flow</h2>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            {marketplacePlans.map((plan) => (
              <PlanCard key={plan.name} {...plan} tone="marketplace" />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-50 text-sky-700">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">DOB Lead Flow</p>
              <h2 className="text-2xl font-black tracking-tight text-stone-900">DOB Lead Flow</h2>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            {intelligencePlans.map((plan) => (
              <PlanCard key={plan.name} {...plan} tone="intelligence" />
            ))}
          </div>
        </section>

        <footer className="rounded-[2rem] border border-stone-200 bg-stone-900 p-8 text-white shadow-2xl shadow-stone-900/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">Next Step</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Enter the Home Pro side of Blueprint.</h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-stone-300">
                Complete your contractor profile, enter the portal, and choose the plan that matches how you actually work.
              </p>
            </div>

            <Link
              to={portalLink}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-stone-900 transition-transform hover:scale-[1.01]"
            >
              Enter Home Pro Portal
              <ArrowRight size={18} />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
