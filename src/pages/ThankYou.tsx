import React from 'react';
import { motion } from 'motion/react';
import { Heart, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function ThankYou() {
  const location = useLocation();
  const hasProject = Boolean(location.state?.projectId);
  const pendingLeadId = location.state?.pendingLeadId as string | undefined;
  const photoUploadIssue = Boolean(location.state?.photoUploadIssue);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-12 text-center"
      >
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Heart size={40} className="text-primary fill-primary/20" />
        </div>
        
        <h1 className="text-3xl font-black tracking-tight mb-4">Project Submitted</h1>
        <div className="space-y-4 mb-10">
          <p className="text-slate-500 leading-relaxed">
            Blueprint Home Solutions has received your home improvement request. Home Pros are now reviewing your project and may request the opportunity to provide a rough estimate.
          </p>
          {photoUploadIssue && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Photo Upload Failed</p>
              <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
                Your request was submitted, but the photo upload failed. Please try uploading the photos again from your project.
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Need To Add More Photos?</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Email additional project photos from the same email address you used on your request to{' '}
              <a href="mailto:info@blueprinthomesolutions.com" className="font-black text-primary hover:underline">
                info@blueprinthomesolutions.com
              </a>{' '}
              and Blueprint will attach them to your submission.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {hasProject ? (
            <Link
              to="/projects"
              state={{
                highlightProjectId: location.state.projectId,
                projectSubmitted: location.state.projectSubmitted,
              }}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform"
            >
              View My Project
              <ArrowRight size={18} />
            </Link>
          ) : (
            <Link
              to={pendingLeadId ? `/login?role=homeowner&redirect=projects&leadId=${encodeURIComponent(pendingLeadId)}` : '/'}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform"
            >
              {pendingLeadId ? 'Go To Project' : 'Back to Home'}
              <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}
