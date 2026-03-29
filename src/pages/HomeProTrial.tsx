import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, ClipboardList, ShieldCheck, Wrench } from 'lucide-react';

const trialHighlights = [
  'Review recently issued NYC DOB permit leads',
  'Test the Home Pro workflow before subscribing',
  'Set up your contractor or tradesman profile',
  'See how Blueprint routes homeowner demand to pros',
];

export default function HomeProTrial() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="flex justify-start">
          <Link to="/" className="inline-flex items-center group">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-20 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <BadgeCheck size={30} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">New Home Pro Trial Subscription</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-7 text-slate-600">
            Homeowners always use Blueprint Home Solutions for free. Contractors and tradesmen can start with a trial subscription to review permit leads, test the platform, and decide if ongoing access fits their business.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ClipboardList size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Trial Access</p>
                <h2 className="text-2xl font-black text-slate-900">What the trial is for</h2>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {trialHighlights.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <CheckCircle2 size={20} className="mt-0.5 text-emerald-600" />
                  <p className="text-sm font-medium leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Wrench size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Start Here</p>
                <h2 className="text-2xl font-black text-slate-900">Contractor / Tradesman signup</h2>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <Link
                to="/signup?role=contractor"
                className="block rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-blue-500/25 transition-transform hover:scale-[1.02]"
              >
                Start Home Pro Trial Signup
              </Link>

              <Link
                to="/login?role=contractor"
                className="block rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:bg-slate-50"
              >
                Already a Home Pro? Log In
              </Link>

              <Link
                to="/"
                className="block text-center text-xs font-black uppercase tracking-[0.16em] text-slate-400 hover:text-slate-600"
              >
                Back Home
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
