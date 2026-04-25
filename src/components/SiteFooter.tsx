import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="bg-slate-900 py-14 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-5 flex flex-col items-start">
              <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-12 w-auto rounded-xl object-contain py-1" />
              <a href="tel:7187019090" className="mt-3 text-sm font-black tracking-[0.14em] text-slate-300 hover:text-white">
                718-701-9090
              </a>
              <a href="mailto:info@blueprinthomesolutions.com" className="mt-2 text-sm font-bold text-slate-300 hover:text-white">
                info@blueprinthomesolutions.com
              </a>
            </div>
            <p className="max-w-md text-sm font-medium leading-6 text-slate-400">
              The vital link between vision and execution. Simplifying home improvement through technology and trust.
            </p>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-widest text-slate-500">Platform</h4>
            <ul className="space-y-3 text-sm font-bold text-slate-300">
              <li><Link to="/how-it-works" className="transition-colors hover:text-white">How it Works</Link></li>
              <li><Link to="/api-intelligence" className="transition-colors hover:text-white">Blueprint DOB Intelligence API</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-widest text-slate-500">Company</h4>
            <ul className="space-y-3 text-sm font-bold text-slate-300">
              <li><Link to="/about" className="transition-colors hover:text-white">About Us</Link></li>
              <li><Link to="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="transition-colors hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            © 2024 Blueprint Home Solutions. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
