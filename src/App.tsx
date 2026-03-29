import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CheckSquare, 
  FileText, 
  Search, 
  Settings, 
  Bell, 
  Menu, 
  X,
  Home,
  Hammer,
  Building2,
  ChevronRight,
  LogOut,
  Star,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useAuth } from './AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Clients from './pages/Clients';
import Projects from './pages/Projects';
import Invoices from './pages/Invoices';
import Marketplace from './pages/Marketplace';
import ProfileSettings from './pages/ProfileSettings';
import Reviews from './pages/Reviews';
import HomeownerDashboard from './pages/HomeownerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Services from './pages/Services';
import HowItWorks from './pages/HowItWorks';
import TermsOfService from './pages/TermsOfService';
import ThankYou from './pages/ThankYou';
import StartProject from './pages/StartProject';
import MessagingWindow from './components/MessagingWindow';
import ScrollToTop from './components/ScrollToTop';
import ContractorPaywall from './pages/ContractorPaywall';
import AboutUs from './pages/AboutUs';
import DOBLeads from './pages/DOBLeads';

const SidebarLink = ({ to, icon: Icon, label, active }: any) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
      active 
        ? "bg-primary text-primary-foreground shadow-md" 
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}
  >
    <Icon size={20} className={cn("transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-muted-foreground")} />
    <span className="font-medium">{label}</span>
    {active && (
      <motion.div 
        layoutId="active-pill"
        className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground"
      />
    )}
  </Link>
);

const Navigation = ({ isMobileMenuOpen, setIsMobileMenuOpen }: { isMobileMenuOpen: boolean, setIsMobileMenuOpen: (open: boolean) => void }) => {
  const location = useLocation();
  const { user } = useAuth();

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, setIsMobileMenuOpen]);

  const contractorLinks = [
    { to: "/projects", icon: Briefcase, label: "Projects" },
    { to: "/permit-feed", icon: Building2, label: "Permit Feed" },
    { to: "/clients", icon: Users, label: "Clients" },
    { to: "/reviews", icon: Star, label: "Reviews" },
    { to: "/invoices", icon: FileText, label: "Invoices" },
  ];

  const homeownerLinks = [
    { to: "/marketplace", icon: Search, label: "Marketplace" },
    { to: "/projects", icon: Briefcase, label: "My Projects" },
    { to: "/invoices", icon: FileText, label: "Invoices" },
  ];

  const adminLinks = [
    { to: "/admin", icon: ShieldCheck, label: "Admin Dashboard" },
    { to: "/projects", icon: Briefcase, label: "All Projects" },
    { to: "/clients", icon: Users, label: "All Users" },
  ];

  const links = user?.role === 'admin' ? adminLinks : (user?.role === 'Contractor' ? contractorLinks : homeownerLinks);

  return (
    <>
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center justify-between">
            <Link to="/" className="flex items-center group">
              <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-40 w-auto object-contain transition-transform group-hover:scale-105" />
            </Link>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-6 space-y-1 overflow-y-auto">
            <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {user?.role === 'admin' ? 'System Admin' : (user?.role === 'Contractor' ? 'Home Pro Portal' : 'Homeowner Portal')}
            </p>
            {links.map((link) => (
              <SidebarLink 
                key={link.to} 
                to={link.to}
                icon={link.icon}
                label={link.label}
                active={location.pathname === link.to} 
              />
            ))}
          </nav>

          <div className="p-6 mt-auto border-t border-slate-100 space-y-1">
            <SidebarLink 
              to="/settings" 
              icon={Settings} 
              label="Settings" 
              active={location.pathname === "/settings"} 
            />
          </div>
        </div>
      </aside>
    </>
  );
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/thank-you');
  };

  const showStartNew = user?.role === 'Homeowner' && 
    location.pathname !== '/start-project' && 
    location.pathname !== '/invoices';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <Navigation isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      <main className="flex-1 lg:ml-72 min-h-screen flex flex-col">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
              <img src={user?.avatar} alt="Profile" referrerPolicy="no-referrer" />
            </div>
            <div className="hidden xs:block">
              <div className="flex items-center gap-2">
                <p className="text-xs md:text-sm font-bold leading-none">{user?.name}</p>
                {user?.role === 'Contractor' && user?.isVerified && (
                  <div className="flex items-center gap-0.5 text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold">
                    <ShieldCheck size={10} className="fill-blue-500" />
                    VERIFIED
                  </div>
                )}
                {user?.role === 'Contractor' && user?.rating && (
                  <div className="flex items-center gap-0.5 text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold">
                    <Star size={10} className="fill-amber-500" />
                    {user.rating}
                  </div>
                )}
              </div>
              <p className="text-[9px] md:text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
                {user?.role === 'admin' ? 'System Administrator' : (user?.role === 'Contractor' ? 'Pro Contractor' : 'Homeowner')}
              </p>
            </div>
          </div>

          {showStartNew && (
            <div className="hidden md:flex flex-1 justify-center px-4">
              <Link 
                to="/start-project"
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Hammer size={18} />
                <span>START NEW</span>
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsMessagingOpen(prev => !prev)}
              className="p-2 text-muted-foreground hover:bg-slate-100 rounded-full transition-colors relative"
            >
              <Bell size={18} md:size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-xs md:text-sm font-bold shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all group"
            >
              <LogOut size={16} md:size={18} className="group-hover:translate-x-0.5 transition-transform" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1">
          <AnimatePresence mode="wait">
            {children}
          </AnimatePresence>
        </div>

        <MessagingWindow 
          isOpen={isMessagingOpen} 
          onClose={() => setIsMessagingOpen(false)} 
        />
      </main>
    </div>
  );
};

const PublicStartProjectPage = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
    <StartProject />
  </div>
);

export default function App() {
  const { user } = useAuth();
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/contractor-paywall" element={<ContractorPaywall />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/start-project" element={<PublicStartProjectPage />} />

        {/* Protected Portal Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                {user?.role === 'Homeowner' && <Route path="/marketplace" element={<Marketplace />} />}
                <Route path="/projects" element={<Projects />} />
                <Route path="/permit-feed" element={<DOBLeads />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/settings" element={<ProfileSettings />} />
                <Route path="/services" element={<Services />} />
                <Route path="/start-project" element={<StartProject />} />
                <Route path="/homeowner-dashboard" element={<Navigate to="/projects" replace />} />
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                {/* Default redirects based on role */}
                <Route path="*" element={<Navigate to={user?.role === 'admin' ? "/admin" : "/projects"} replace />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}
