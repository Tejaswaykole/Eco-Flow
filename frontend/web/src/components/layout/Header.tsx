import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Bell, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { NotificationService } from '../../services';
import { NotificationItem } from '../../types';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../../lib/utils';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const count = await NotificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently continue if unauthenticated or network error
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await NotificationService.listNotifications();
      setNotifications(res.data || []);
      setUnreadCount(res.pagination?.unreadCount || 0);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const handleMarkOneRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await NotificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await NotificationService.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchUnreadCount();
    } catch {
      // Ignore
    }
  };

  const handleItemClick = (notif: NotificationItem) => {
    if (!notif.is_read) {
      NotificationService.markAsRead(notif.id).catch(() => {});
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 relative z-30">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 uppercase tracking-wider">
          Workspace Active
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification Bell with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="min-w-4 h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full absolute -top-0.5 -right-0.5 flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {loading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No notifications yet</div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      className={`px-4 py-3 hover:bg-slate-50/80 cursor-pointer transition-colors flex items-start gap-3 text-left ${
                        !n.is_read ? 'bg-teal-50/30' : ''
                      }`}
                    >
                      <div
                        className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                          !n.is_read ? 'bg-primary ring-2 ring-teal-200' : 'bg-transparent'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{n.title}</div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {formatDate(n.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!n.is_read && (
                          <button
                            onClick={(e) => handleMarkOneRead(n.id, e)}
                            className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-100"
                            title="Mark as read"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDismiss(n.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100"
                          title="Dismiss"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/50 flex justify-center">
                <Link
                  to="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>View all in Notification Center</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200" />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0 overflow-hidden">
            {user && (user.firstName || user.lastName) ? (
              `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
          <div className="hidden sm:flex flex-col text-left text-xs">
            <div className="font-semibold text-slate-900 leading-tight truncate max-w-[160px]">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || user?.lastName || user?.email || 'Signed In User'}
            </div>
            <div className="text-slate-500 font-medium capitalize text-[11px] leading-tight truncate max-w-[160px]">
              {user?.roles?.[0] ? user.roles[0].replace(/_/g, ' ').toLowerCase() : 'Member'}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-500 hover:text-rose-600 ml-1 shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
