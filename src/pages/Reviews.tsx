import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, 
  MessageSquare, 
  User as UserIcon, 
  ThumbsUp, 
  Filter,
  Search,
  CheckCircle2,
  Plus,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, getDocs } from 'firebase/firestore';
import { Project } from '../types';

interface Review {
  id: string;
  authorId: string;
  targetId: string;
  projectId: string;
  rating: number;
  content: string;
  authorName: string;
  authorAvatar: string;
  authorRole: string;
  projectName: string;
  createdAt: string;
}

export default function Reviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProjects, setUserProjects] = useState<Project[]>([]);

  // Form state for new review
  const [newReview, setNewReview] = useState({
    targetId: '',
    projectId: '',
    rating: 5,
    content: '',
    projectName: ''
  });

  // For the demo, let's fetch some potential targets (other users)
  const [potentialTargets, setPotentialTargets] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch reviews where the current user is the target
    const reviewsRef = collection(db, 'reviews');
    const q = query(reviewsRef, where('targetId', '==', user.id), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      setReviews(reviewsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching reviews:", error);
      setIsLoading(false);
    });

    // Fetch potential targets for the "Add Review" demo
    const fetchTargets = async () => {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const targets = snapshot.docs
        .map(doc => ({ id: doc.id, name: doc.data().name }))
        .filter(t => t.id !== user.id);
      setPotentialTargets(targets);
    };
    fetchTargets();

    // Fetch user's projects to check for completed/abandoned ones
    const projectsRef = collection(db, 'projects');
    const projectsQuery = query(projectsRef, where('uid', '==', user.id));
    
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setUserProjects(projectsData);
    });

    return () => {
      unsubscribe();
      unsubscribeProjects();
    };
  }, [user]);

  const hasReviewableProjects = userProjects.some(p => p.status === 'Completed' || p.status === 'Abandoned');

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        ...newReview,
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar || `https://picsum.photos/seed/${user.email}/100/100`,
        authorRole: user.role,
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
      setIsModalOpen(false);
      setNewReview({
        targetId: '',
        projectId: 'demo-project',
        rating: 5,
        content: '',
        projectName: 'Home Renovation'
      });
    } catch (error) {
      console.error("Error adding review:", error);
      alert("Failed to add review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: reviews.filter(rev => rev.rating === r).length,
    percentage: reviews.length > 0 ? (reviews.filter(rev => rev.rating === r).length / reviews.length) * 100 : 0
  }));

  const filteredReviews = reviews.filter(r => 
    r.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.authorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.projectName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reviews & Ratings</h1>
          <p className="text-muted-foreground mt-1">Feedback from your clients and partners.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Star className="text-amber-400 fill-amber-400" size={20} />
            <span className="text-lg font-bold">{averageRating}</span>
            <span className="text-slate-400 text-sm font-medium">({reviews.length} reviews)</span>
          </div>
          {hasReviewableProjects && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus size={20} />
              <span>Write Review</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold mb-4">Rating Breakdown</h3>
            <div className="space-y-3">
              {ratingCounts.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-3">{rating}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-400 h-full rounded-full" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 w-8">
                    {Math.round(percentage)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
            <h3 className="font-bold text-primary mb-2">Verified Reviews</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              All reviews on this platform are from verified jobs completed through the inspection and estimate process.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search reviews..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-[1.05] transition-all">
              <Filter size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {filteredReviews.length > 0 ? (
              filteredReviews.map((review) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={review.id} 
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-100 bg-slate-100 flex items-center justify-center">
                        {review.authorAvatar ? (
                          <img src={review.authorAvatar} alt={review.authorName} referrerPolicy="no-referrer" />
                        ) : (
                          <UserIcon size={24} className="text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold">{review.authorName}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wider">
                            {review.authorRole}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={12} 
                              className={cn(
                                i < review.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                              )} 
                            />
                          ))}
                          <span className="text-[10px] text-slate-400 font-bold ml-2">{review.createdAt}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Project</p>
                      <p className="text-xs font-bold text-primary">{review.projectName}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed italic">
                    "{review.content}"
                  </p>

                  <div className="mt-6 flex items-center gap-4 pt-4 border-t border-slate-50">
                    <button className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors">
                      <ThumbsUp size={14} />
                      Helpful
                    </button>
                    <button className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors">
                      <MessageSquare size={14} />
                      Reply
                    </button>
                    <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <CheckCircle2 size={12} />
                      Verified Job
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-white p-20 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                  <Star size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No reviews yet</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-xs">Reviews from your clients will appear here once you complete projects on the platform.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Write Review Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Write a Review</h2>
                  <p className="text-sm text-slate-500 font-medium">Share your experience with another user.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddReview} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Who are you reviewing?</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    value={newReview.targetId}
                    onChange={e => setNewReview({...newReview, targetId: e.target.value})}
                  >
                    <option value="">Select a user...</option>
                    {potentialTargets.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Project Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder=""
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    value={newReview.projectName}
                    onChange={e => setNewReview({...newReview, projectName: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReview({...newReview, rating: star})}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star 
                          size={32} 
                          className={cn(
                            star <= newReview.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                          )} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Your Review</label>
                  <textarea 
                    required
                    placeholder="Tell us about your experience..."
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium h-32 resize-none"
                    value={newReview.content}
                    onChange={e => setNewReview({...newReview, content: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting || !newReview.targetId}
                    className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Posting..." : "Post Review"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
