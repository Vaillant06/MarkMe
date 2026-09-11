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
        <div className="flex items-center space-x-3">
          <div className="w-24 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-inner">
            MarkMe
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">SSN</span>
              <span className="text-xs bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                Attendance Portal
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Sri Sivasubramaniya Nadar College of Engineering
            </p>
          </div>
        </div>

        {user && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="text-slate-200 font-medium">{user.email}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition border border-slate-700"
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
