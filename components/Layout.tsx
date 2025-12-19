
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  role: 'employee' | 'admin';
  onRoleSwitch: () => void;
}

const Logo: React.FC = () => (
  <div className="flex flex-col items-center select-none" style={{ width: 'fit-content' }}>
    {/* METABEV - Georgia/Serif font with wide letter spacing as per the image */}
    <div 
      className="text-[44px] leading-none tracking-[0.25em] text-brand-600 mb-2" 
      style={{ fontFamily: 'Georgia, serif' }}
    >
      METABEV
    </div>
    
    {/* PASSIONATE F & B PARTNERS - Clean Sans-serif with very wide tracking */}
    <div 
      className="text-[12px] font-medium leading-none tracking-[0.45em] text-slate-800 mb-3 uppercase"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      Passionate F & B Partners
    </div>
    
    {/* SINCE 1989 - Centered below the partner text with wide tracking */}
    <div 
      className="text-[12px] font-medium leading-none tracking-[0.45em] text-slate-800 uppercase"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      Since 1989
    </div>
  </div>
);

const Layout: React.FC<LayoutProps> = ({ children, title, role, onRoleSwitch }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 py-6 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center">
            {/* Logo is placed exactly in the top-left section */}
            <Logo />
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-4">
              <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {role === 'employee' ? 'STAFF PORTAL' : 'ASSESSOR HUB'}
              </span>
            </nav>
            <button 
              onClick={onRoleSwitch}
              className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Switch View to {role === 'employee' ? 'Assessor' : 'Employee'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-12">
        <div className="mb-12 print:hidden">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{title}</h2>
          <div className="h-2 w-24 bg-brand-600 mt-4 rounded-full"></div>
        </div>
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4 flex justify-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">
            METABEV Staff Performance Review
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
