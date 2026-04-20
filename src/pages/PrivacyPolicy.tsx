import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
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
          <h1 className="text-3xl font-black tracking-tight mb-8">Privacy Policy</h1>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-600">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Business Identity</h2>
              <p>
                Blueprint Home Solutions, LLC is located at 132-23 Bennett Court, Jamaica, NY 11434. Questions about this policy may be sent to info@blueprinthomesolutions.com or directed to 718-701-9090.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">1. Information We Collect</h2>
              <p>
                Blueprint Home Solutions may collect information you provide directly, including your name, email address, phone number, property details, project details, account profile information, and any documents or photos you upload.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">2. How We Use Information</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>To create and manage your account.</li>
                <li>To connect homeowners with contractors, tradesmen, and related professionals.</li>
                <li>To operate project workflows, communications, invoices, and lead delivery.</li>
                <li>To improve platform performance, security, and user experience.</li>
                <li>To comply with legal obligations and enforce platform terms.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">3. Sharing of Information</h2>
              <p>
                We may share relevant project and contact information with service providers and users as necessary to operate the marketplace. We may also share information with vendors, hosting providers, analytics providers, and legal authorities where required by law or for platform protection.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">4. Communications</h2>
              <p>
                By using the platform, you consent to receive service-related communications, including project updates, account notices, and transactional emails or messages. Marketing communications may be sent where permitted and can be opted out of where applicable.
              </p>
              <p>
                Contractors who choose SMS notifications in their account settings may receive transactional lead-alert messages related to homeowner project requests that match their trade and service area. Message frequency varies based on homeowner submissions and contractor preferences. Recipients may opt out of SMS notifications through platform settings and applicable reply keywords such as STOP where supported.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data Retention</h2>
              <p>
                We retain personal information for as long as reasonably necessary to operate the platform, maintain records, resolve disputes, comply with legal requirements, and enforce agreements.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">6. Security</h2>
              <p>
                We use reasonable administrative, technical, and organizational safeguards to protect personal information. No internet-based system is guaranteed to be fully secure, and users should also protect their own credentials and account access.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">7. Your Choices</h2>
              <p>
                You may request updates or corrections to your account information. Certain information may remain in our records as needed for legal, security, operational, and transaction-history purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">8. Third-Party Services</h2>
              <p>
                The platform may use third-party tools or link to third-party services. Their privacy practices are governed by their own policies, not this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">9. Children&apos;s Privacy</h2>
              <p>
                The platform is not intended for children under 13, and we do not knowingly collect personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">10. Updates to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Continued use of the platform after changes are posted constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">11. Contact</h2>
              <p>
                Questions about this Privacy Policy may be directed to Blueprint Home Solutions, LLC at info@blueprinthomesolutions.com or 718-701-9090.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
