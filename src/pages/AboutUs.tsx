import { Link } from 'react-router-dom';

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">About Us</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Blueprint Home Solutions</h1>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
            Operated by Dzyn Indie Films LLC
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="space-y-6 text-base font-medium leading-8 text-slate-600">
            <p>
              Blueprint Home Solutions is a DBA operated by Dzyn Indie Films LLC. The platform helps homeowners submit project requests and helps contractors receive relevant lead notifications based on trade, service area, and account preferences.
            </p>
            <p>
              Blueprint Home Solutions is designed to route homeowner requests into a structured workflow that supports project intake, contractor matching, marketplace notifications, and account-based communication.
            </p>
            <p>
              Contractors who create an account may opt in to receive transactional notifications about homeowner project leads that match their categories and service areas. These notifications are intended for operational lead delivery, not purchased-list marketing.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <h2 className="text-xl font-black text-slate-900">Business Information</h2>
          <div className="mt-6 space-y-3 text-sm font-bold uppercase tracking-widest text-slate-500">
            <p>Legal Entity: Dzyn Indie Films LLC</p>
            <p>DBA: Blueprint Home Solutions</p>
            <p>Address: 132-23 Bennett Court, Jamaica, NY 11434</p>
            <p>Phone: 718-701-9090</p>
            <p>Email: info@blueprinthomesolutions.com</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <h2 className="text-xl font-black text-slate-900">Transactional SMS Use Case</h2>
          <div className="mt-6 space-y-4 text-base font-medium leading-8 text-slate-600">
            <p>
              Blueprint Home Solutions uses account-based notifications to inform opted-in contractors about relevant homeowner project leads. Message content is limited to transactional project information such as trade category, location, and requested start timing.
            </p>
            <p>
              Example messages include notifications like: &ldquo;Blueprint: New homeowner lead for roofing in Queens. Start date: May 3. Log in for details.&rdquo;
            </p>
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
