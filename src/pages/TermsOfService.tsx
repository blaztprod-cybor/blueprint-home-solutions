import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, ArrowLeft, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  const handleContinue = () => {
    if (agreed) {
      navigate('/signup');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex flex-col items-center">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-12 w-auto rounded-xl object-contain py-1" />
            <a href="tel:7187019090" className="mt-2 text-sm font-black tracking-[0.14em] text-slate-600 hover:text-primary">
              718-701-9090
            </a>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary transition-colors">
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12"
        >
          <h1 className="text-3xl font-black tracking-tight mb-8">Website Terms of Service</h1>
          
          <div className="prose prose-slate max-w-none space-y-8 text-slate-600">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Blueprint Home Solutions (“BHS”, “we”, or “our platform”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree, do not use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">2. Description of Service</h2>
              <p>
                Blueprint Home Solutions provides a marketplace platform connecting homeowners with vetted home improvement professionals, including contractors, tradesmen, and developers.
              </p>
              <p className="mt-2">Our platform’s goal is to simplify the home improvement process from start to finish by:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Advising homeowners on best practices</li>
                <li>Helping users identify verified, professional contractors and tradesmen</li>
                <li>Providing guidance and research on service providers’ work history</li>
              </ul>
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-900 mb-1">Important:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>BHS does not provide financing or loans of any kind. Our revenue comes from creating a bridge between homeowners and service providers.</li>
                  <li>BHS does not perform the work itself and does not guarantee the quality, safety, or legality of the services performed by independent contractors.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">3. User Responsibilities</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">Homeowners:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Responsible for reviewing contractor profiles and verifying suitability.</li>
                    <li>Must ensure any agreements, including payment and change order clauses, are formalized in writing.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">Contractors/Tradesmen/Developers:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Must provide accurate information regarding qualifications, licenses, and past work history.</li>
                    <li>Agree to adhere to the payment options specified through the platform.</li>
                    <li>Must not attempt to circumvent the platform to solicit or contract with homeowners outside of BHS for a period of 12 months following initial contact via the platform.</li>
                    <li>Must comply with all local laws and regulations, including NYC DOB regulations.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">All Users:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Are responsible for maintaining the confidentiality of their account credentials.</li>
                    <li>Must not engage in harassment, intimidation, or conduct that harms BHS’s reputation.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">4. Non-Circumvention</h2>
              <p>
                Contractors and developers agree that all business originating from a homeowner introduction via BHS must be conducted through the platform unless explicitly authorized. Circumventing BHS to engage in direct business with homeowners or developers constitutes a breach of these Terms and may result in legal action, including claims for damages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">5. Payments & Agreements</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>BHS facilitates connection; all payment agreements are between the homeowner and contractor.</li>
                <li>All work agreements must include a Change Order Clause to minimize disputes.</li>
                <li>BHS is not responsible for payment disputes, delays, or fulfillment of services.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">6. Limitation of Liability</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>BHS is only a platform and is not responsible for disputes, damages, or quality issues arising from contracts between homeowners and contractors/tradesmen.</li>
                <li>To the fullest extent permitted by law, BHS disclaims all warranties, whether express, implied, or statutory, including guarantees of work quality or completeness.</li>
                <li>Users agree to indemnify and hold harmless BHS from any claims, damages, or losses arising from their use of the platform or agreements made through it.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">7. Protection Against Harassment & Misconduct</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Any contractor, tradesman, or developer who engages in harassment, illegal activity, or actions that harm BHS’s reputation may be subject to removal from the platform and legal action.</li>
                <li>Users acknowledge that litigation may be pursued if such actions occur, and agree to cooperate with any investigations or legal proceedings as required.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">8. Privacy & Data</h2>
              <p>
                Your use of the platform is governed by our Privacy Policy, which explains how we collect, use, and protect personal data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">9. Modifications</h2>
              <p>
                BHS reserves the right to update or modify these Terms at any time. Continued use of the platform constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">10. Governing Law & Dispute Resolution</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>These Terms are governed by the laws of the State of New York.</li>
                <li>Any disputes arising from use of BHS should first attempt to be resolved via mediation or arbitration.</li>
                <li>BHS reserves the right to pursue legal action in cases of non-circumvention, harassment, or reputational harm.</li>
              </ul>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100">
            <label className="flex items-start gap-4 cursor-pointer group" htmlFor="terms-checkbox">
              <div className="relative flex items-center justify-center mt-1">
                <input 
                  type="checkbox" 
                  id="terms-checkbox"
                  className="peer appearance-none w-6 h-6 border-2 border-slate-200 rounded-lg checked:border-black transition-all cursor-pointer"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <motion.div
                  initial={false}
                  animate={{ 
                    opacity: agreed ? 1 : 0,
                    scale: agreed ? 1 : 0.5
                  }}
                  transition={{ duration: 0.2 }}
                  className="absolute text-black pointer-events-none flex items-center justify-center"
                >
                  <Check size={16} strokeWidth={4} />
                </motion.div>
              </div>
              <span className="text-sm font-medium text-slate-700 select-none">
                I have read and agree to the Website Terms of Service. I understand that Blueprint Home Solutions is a bridge between homeowners and contractors.
              </span>
            </label>

            <button
              onClick={handleContinue}
              disabled={!agreed}
              className={`w-full mt-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl ${
                agreed 
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]" 
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              Continue to Sign Up
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
