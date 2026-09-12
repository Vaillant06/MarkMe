import React from 'react';
import { LogOut, User, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding Lockup */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* MarkMe Brand Logo */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-blue-600 text-white shadow-sm ring-1 ring-white/15 select-none flex-shrink-0 cursor-default">
            <CheckCircle2 className="w-4 h-4 text-blue-200 flex-shrink-0" />
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
              MarkMe
            </span>
          </div>

          {/* Vertical Divider */}
          <div className="h-8 w-px bg-slate-700/80 hidden sm:block flex-shrink-0" />

          {/* Organization & Application Context */}
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-slate-100 tracking-tight leading-snug truncate">
              <span className="hidden sm:inline">SSN College of Engineering</span>
              <span className="sm:hidden">SSN</span>
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium tracking-normal hidden sm:block leading-tight">
              Attendance Portal
            </span>
          </div>
        </div>

        {/* Right User & Logout Controls */}
        {user && (
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden flex-shrink-0">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="text-slate-200 font-medium max-w-[110px] sm:max-w-[200px] md:max-w-none truncate">
                {user.email}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            </div>

            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition border border-slate-700 flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
