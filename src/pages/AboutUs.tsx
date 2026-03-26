import { Link } from 'react-router-dom';

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">About Us</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Blueprint Home Solutions</h1>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="space-y-6 text-base font-medium leading-8 text-slate-600">
            <p>
              Blueprint Home Solutions is the brainchild of Shawn Raynor. He has spent his life in pursuit of fairness, and as a homeowner he has dealt with several contractors and believed this platform could save homeowners time, money, and headache.
            </p>
            <p>
              We are local but looking to grow. The proof is in the pugging. Do what you say, say what you mean. We are only human, but if we can get it right the first time then that is the goal.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <h2 className="text-xl font-black text-slate-900">Company Contact</h2>
          <div className="mt-6 space-y-3 text-sm font-bold uppercase tracking-widest text-slate-500">
            <p>132-23 Bennett Court</p>
            <p>Jamaica, NY</p>
            <p>Phone: 718-701-9090</p>
            <p>Email: infor@blueprinthomesolutions</p>
          </div>
        </div>

        <div className="flex justify-center">
          <Link to="/" className="rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-primary">
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
