import { Link } from 'react-router-dom';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';

const plans = [
  {
    name: 'One Week Access',
    price: '$8',
    term: 'one time',
    description: 'Short access to review active marketplace leads and test the platform.'
  },
  {
    name: 'Monthly Access',
    price: '$25',
    term: 'per month',
    description: 'Best fit for active contractors and tradesmen working leads every week.'
  },
  {
    name: 'Yearly Access',
    price: '$125',
    term: 'per year',
    description: 'Lowest long-term rate for professionals growing with Blueprint Home Solutions.'
  }
];

export default function ContractorPaywall() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Lock size={30} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Marketplace Access For Home Pros</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-7 text-slate-600">
            Marketplace lead access is reserved for paid contractor and tradesman subscribers. Choose a plan to review project opportunities and participate through the platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                <span className="pb-1 text-sm font-bold text-slate-400">{plan.term}</span>
              </div>
              <p className="mt-4 text-sm font-medium leading-6 text-slate-600">{plan.description}</p>
              <button className="mt-8 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                Choose Plan
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
              <ShieldCheck size={24} />
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Platform Rules</p>
              <p className="text-sm font-medium leading-7 text-amber-900">
                Paid access is designed to protect homeowners and contractors alike. Blueprint Home Solutions exists to create balance, fairness, and clear compensation rules for introductions made through the platform.
              </p>
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <CheckCircle2 size={18} />
                Access to project leads happens through subscription.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/signup?role=contractor" className="rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-primary">
            Join As Contractor
          </Link>
          <Link to="/" className="rounded-2xl border border-slate-200 bg-white px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:bg-slate-50">
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
