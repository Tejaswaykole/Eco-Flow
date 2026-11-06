import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Bell } from 'lucide-react';
import { Button } from '../ui/Button';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 uppercase tracking-wider">
          Workspace Active
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="w-2 h-2 bg-primary rounded-full absolute top-2 right-2 ring-2 ring-white"></span>
        </button>

        <div className="h-6 w-px bg-slate-200" />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs">
            {user ? `${user.firstName[0]}${user.lastName[0]}` : <User className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left text-xs">
            <div className="font-semibold text-slate-900 leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : 'Signed In User'}
            </div>
            <div className="text-slate-500 font-medium capitalize">
              {user?.roles?.[0]?.toLowerCase() || 'Member'}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-500 hover:text-rose-600 ml-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

