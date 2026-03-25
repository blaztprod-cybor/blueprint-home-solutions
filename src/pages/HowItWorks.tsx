import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ShieldCheck, Zap, Building2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HowItWorks() {
  const stages = [
    {
      title: "Stage 1: Planning & Design",
      image: "/stage1.png",
      desc: "Laying the foundation with a detailed plan for the materials and timeline."
    },
    {
      title: "Stage 2: Structural Work",
      image: "/stage2.png",
      desc: "Framing, plumbing, and electrical systems being installed by vetted pros."
    },
    {
      title: "Stage 3: Interior Finishing",
      image: "/stage3.png",
      desc: "Drywall, flooring, and cabinetry bringing the vision to life."
    },
    {
      title: "Stage 4: Final Touches",
      image: "/stage4.png",
      desc: "The finished product, ready for move-in and final inspection."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-12 w-auto object-contain py-1" />
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary transition-colors">
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-6">How It Works</h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Blueprint Home Solutions innovative approach to simplifying the entire home improvement process, from beginning to end, financing to finished. By advising homeowner on best practices. Blueprint Home Solutions does not do Financing, we do not offer loans of any kind our money is made by creating a bridge. In the Homeowners portal will help you find professional tradesmen and contractors that you can really work with. We have done the research by looking at verified work history. We share this knowledge, making sure everyone is on the same page.
          </p>
        </motion.div>

        {/* Stages Grid */}
        <div className="grid md:grid-cols-2 gap-12 mb-20">
          {stages.map((stage, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100"
            >
              <img 
                src={stage.image} 
                alt={stage.title} 
                className="w-full h-64 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="p-8">
                <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{stage.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Payment Options Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-slate-900 text-white rounded-[3rem] p-12 lg:p-20 overflow-hidden relative"
        >
          <div className="relative z-10">
            <h2 className="text-3xl lg:text-4xl font-black mb-8">It's all in the paperwork</h2>
            <p className="text-slate-400 text-lg mb-12 max-w-2xl">
              When a homeowner chooses a Contractor/tradesman on our platform both parties have agreed to one of these three payment options. All agreements must have a Change order Clause to minimize the change for a dispute. It's in the Contractor/Tradesman Terms of Service.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  id: "1",
                  title: "Fixed Price",
                  subtitle: "Lump Sum Contract",
                  desc: "A single set price for the entire scope of work, providing maximum budget certainty."
                },
                {
                  id: "2",
                  title: "Cost - Plus",
                  subtitle: "Contract",
                  desc: "Payment for actual construction costs plus a pre-negotiated fee for the contractor."
                },
                {
                  id: "3",
                  title: "GMP",
                  subtitle: "Guaranteed Maximum Price",
                  desc: "A cost-plus contract where the contractor guarantees the project will not exceed a set price."
                }
              ].map((option) => (
                <div key={option.id} className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-3xl">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mb-6 font-bold text-white">
                    {option.id}
                  </div>
                  <h4 className="text-xl font-bold mb-1">{option.title}</h4>
                  <p className="text-primary text-xs font-bold uppercase tracking-widest mb-4">{option.subtitle}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{option.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -z-0" />
        </motion.section>
      </main>
    </div>
  );
}
