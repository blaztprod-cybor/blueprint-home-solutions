import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Building2, ShieldCheck, Zap, Users, Hammer, CheckCircle2, Home, DraftingCompass, LogOut, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { fetchDOBPermits } from '../services/dobService';
import { DOBPermit } from '../types';
import { projectCategories } from '../data/projectCategories';

export default function Landing() {
  const PREVIEW_ITEMS_PER_PAGE = 20;
  const featuredCategoryIds = ['roofs', 'bathrooms', 'kitchens', 'basements', 'windows', 'fencing', 'brickwork', 'floors'];
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [permitData, setPermitData] = useState<DOBPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPage, setPreviewPage] = useState(1);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchDOBPermits(1000);
        setPermitData(data);
      } catch (error) {
        console.error('Error loading permit data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const previewTotalPages = Math.max(1, Math.ceil(permitData.length / PREVIEW_ITEMS_PER_PAGE));
  const previewRows = permitData.slice(
    (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE,
    previewPage * PREVIEW_ITEMS_PER_PAGE
  );

  const previewPages = Array.from(
    { length: Math.min(5, previewTotalPages) },
    (_, index) => {
      const startPage = Math.min(
        Math.max(1, previewPage - 2),
        Math.max(1, previewTotalPages - 4)
      );
      return startPage + index;
    }
  );

  const formatPermitDate = (value: string) => {
    if (!value) return 'N/A';

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const footerMarketplaceLink = user?.role === 'Contractor' ? '/contractor-paywall' : '/contractor-paywall';
  const featuredCategories = projectCategories.filter((category) => featuredCategoryIds.includes(category.id));

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.32]"
          style={{ backgroundImage: "url('/hero-image-v2.jpg')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.56)_0%,rgba(248,250,252,0.74)_28%,rgba(248,250,252,0.88)_58%,rgba(248,250,252,0.96)_100%)]" />
      </div>

      <div className="relative z-10">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 md:gap-5">
              <Link to="/" className="flex shrink-0 items-center">
                <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-16 w-auto rounded-2xl object-contain py-1 md:h-32" />
              </Link>
              <a
                href="tel:7187019090"
                className="hidden whitespace-nowrap text-base font-black tracking-[0.14em] text-slate-600 hover:text-primary md:block"
              >
                718-701-9090
              </a>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link to="/how-it-works" className="text-sm font-bold text-slate-600 hover:text-primary transition-colors">How it Works</Link>
              <Link to="/home-pro-trial" className="text-sm font-bold text-slate-600 hover:text-primary transition-colors">Pricing</Link>
              <div className="flex items-center gap-4">
                {!user && (
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-transform bg-slate-900 text-white shadow-lg shadow-slate-300/60 hover:scale-[1.02]"
                  >
                    Login
                  </Link>
                )}
                {user && (
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/30 hover:scale-[1.02] transition-transform group"
                  >
                    <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 md:hidden">
            <Link
              to="/how-it-works"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 transition-colors hover:bg-slate-50"
            >
              How it Works
            </Link>
            <Link
              to="/home-pro-trial"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 transition-colors hover:bg-slate-50"
            >
              Pricing
            </Link>
            {!user && (
              <Link
                to="/login"
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-slate-300/60"
              >
                Login
              </Link>
            )}
            {user && (
              <button 
                onClick={handleLogout}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-purple-500/30"
              >
                Logout
              </button>
            )}
          </div>
          <div className="-mt-10 text-center md:-mt-16">
            <p className="text-xl font-black leading-tight text-slate-900 md:text-3xl">
              Home Improvement Marketplace
            </p>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto md:pt-36">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="flex flex-col gap-4 items-center text-center">
              <div>
                <p className="mt-4 text-2xl font-black tracking-tight text-slate-700 sm:text-3xl">
                  Select your improvement to start the process
                </p>
              </div>
            </div>

            <div className="overflow-x-auto pb-3">
              <div className="flex min-w-max justify-center gap-3 px-4">
                {featuredCategories.map((category) => {
                  const cardContent = (
                    <div className="space-y-3">
                      <div className="relative h-32 overflow-hidden rounded-[1.2rem]">
                        <div
                          className="absolute inset-0 bg-cover bg-center brightness-[1.14] saturate-[1.18] contrast-[1.04]"
                          style={{ backgroundImage: `url('${category.image}')`, backgroundPosition: category.imagePosition ?? 'center' }}
                        />
                        <div className={cn(
                          "absolute inset-0",
                          user?.role === 'Contractor'
                            ? "bg-slate-950/30"
                            : "bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(15,23,42,0.06)_40%,rgba(15,23,42,0.18)_100%)]"
                        )} />
                      </div>
                      <Link
                        to={`/start-project?category=${encodeURIComponent(category.id)}`}
                        state={{ category: category.id }}
                        className="block w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-500/20"
                      >
                        Select
                      </Link>
                    </div>
                  );

                  if (user?.role === 'Contractor') {
                    return (
                      <div
                        key={category.id}
                        className="group w-[122px] cursor-not-allowed text-left text-slate-400"
                      >
                        {cardContent}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={category.id}
                      className="group w-[122px] text-left"
                    >
                      {cardContent}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mx-auto max-w-4xl text-base leading-relaxed text-slate-600 text-center sm:text-lg">
              We serve as the vital link between vision and execution. We simplify the home improvement process by connecting homeowners with a curated network of vetted, reliable contractors. We also bring highly valuable leads to contractors and tradesmen with the "Recently Issued Permits Data Feed."
            </p>
            <div className="flex justify-center">
              <Link
                to="/home-pro-trial"
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-blue-500/25 transition-transform hover:scale-[1.02]"
              >
                Sign Up as a Home Professional
              </Link>
            </div>
          </motion.div>

          <div className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12 lg:pt-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="order-2 w-full lg:order-1"
          >
            <div className="w-full overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 bg-white p-2 sm:p-3 shadow-xl shadow-slate-200/40">
              <div className="relative aspect-video overflow-hidden rounded-[1.125rem] sm:rounded-[1.5rem] bg-slate-950">
                <iframe
                  className="h-full w-full"
                  src="https://www.youtube.com/embed/2d0qOtWXNyQ"
                  title="Blueprint Home Solutions Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
            <div className="relative z-10 mt-4 rounded-[1.5rem] border border-slate-100 bg-white p-3 shadow-2xl sm:mt-6 sm:rounded-3xl sm:p-4">
              <img 
                src="/hero-image-v2.jpg" 
                alt="Blueprint Home Solutions - Free Estimates" 
                className="rounded-[1.125rem] sm:rounded-2xl w-full h-auto object-cover"
              />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative order-1 mx-auto w-full max-w-full lg:order-2 lg:max-w-none lg:mx-0"
          >
            <p className="mx-auto mb-4 max-w-[18rem] text-center text-base font-black tracking-tight text-slate-700 sm:max-w-none sm:text-lg">
              Hundreds of new residential and commercial leads updated daily
            </p>
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
              <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black tracking-tight">Recently Issued Permits</h2>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">NYC DOB</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Updated Daily</span>
                </div>
                </div>
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="text-xs font-bold text-rose-600">
                  Full Permit data available with subscription, full address, company name, contact number.
                </p>
              </div>
              {!loading && permitData.length > 0 && (
                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-slate-500">
                    Preview Pages {previewPage}-{previewTotalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                      disabled={previewPage === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous preview page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {previewPages.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setPreviewPage(page)}
                        className={cn(
                          "h-9 min-w-[36px] rounded-lg border px-2 text-xs font-bold transition-colors",
                          previewPage === page
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPreviewPage((page) => Math.min(previewTotalPages, page + 1))}
                      disabled={previewPage === previewTotalPages}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next preview page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <div className="max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-white shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Borough</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Street</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Issue Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Job Description</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-16 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <Loader2 className="animate-spin text-primary mb-4" size={28} />
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fetching Live Data...</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-sm font-bold text-slate-700">{row.borough}</td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-500">{row.street_name}</td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-500">
                              <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
                                {formatPermitDate(row.issuance_date)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-600 italic whitespace-nowrap">{row.job_description}</td>
                            <td className="px-4 py-3 text-sm font-medium">
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                                row.permit_status === 'Permit Issued' || row.permit_status === 'ISSUED'
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-slate-50 text-slate-600"
                              )}>
                                {row.permit_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {!loading && permitData.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-slate-500">
                    Preview Pages {previewPage}-{previewTotalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                      disabled={previewPage === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous preview page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {previewPages.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setPreviewPage(page)}
                        className={cn(
                          "h-9 min-w-[36px] rounded-lg border px-2 text-xs font-bold transition-colors",
                          previewPage === page
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPreviewPage((page) => Math.min(previewTotalPages, page + 1))}
                      disabled={previewPage === previewTotalPages}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next preview page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 rounded-full blur-3xl -z-10" />
          </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'For Homeowners',
                icon: Home,
                desc: 'Access a curated list of contractors, manage budgets, and track project progress in real-time.',
                color: 'bg-blue-50 text-blue-600'
              },
              {
                title: 'For Contractors',
                icon: Hammer,
                desc: 'Get high-quality leads from NYC DOB data, manage invoices, and build your reputation.',
                color: 'bg-primary/10 text-primary'
              },
              {
                title: 'For Developers',
                icon: DraftingCompass,
                desc: 'Scale your operations with a reliable network of tradesmen and streamlined project oversight.',
                color: 'bg-purple-50 text-purple-600'
              }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-3xl border border-slate-100 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all group">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform", feature.color)}>
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="mb-6 flex flex-col items-center">
                <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-12 w-auto rounded-xl object-contain py-1" />
                <a href="tel:7187019090" className="mt-2 text-sm font-black tracking-[0.14em] text-slate-300 hover:text-white">
                  718-701-9090
                </a>
              </div>
              <p className="text-slate-400 max-w-md leading-relaxed">
                The vital link between vision and execution. Simplifying home improvement through technology and trust.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-slate-500">Platform</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-300">
                <li><Link to="/how-it-works" className="hover:text-white transition-colors">How it Works</Link></li>
                <li><Link to={footerMarketplaceLink} className="hover:text-white transition-colors">Marketplace</Link></li>
                {!user && <li><Link to="/signup?role=contractor" className="hover:text-white transition-colors">Join as Contractor</Link></li>}
                {!user && <li><Link to="/signup?role=homeowner" className="hover:text-white transition-colors">Hire a Pro</Link></li>}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-slate-500">Company</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-300">
                <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Safety</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">© 2024 Blueprint Home Solutions. All rights reserved.</p>
            <div className="flex gap-6 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
