import React, { useState, useEffect } from 'react';
import { NotificationService } from '../../services';
import { NotificationItem } from '../../types';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { Bell, CheckCheck, Trash2, ExternalLink, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../lib/utils';

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await NotificationService.listNotifications();
      setNotifications(res.data || []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Ignore
    }
  };

  const handleMarkOneRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await NotificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // Ignore
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await NotificationService.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Ignore
    }
  };

  const handleNavigate = (n: NotificationItem) => {
    if (!n.is_read) {
      NotificationService.markAsRead(n.id).catch(() => {});
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  const filtered = filter === 'UNREAD' ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Unified feed of business events, approval requests, and automated system alerts."
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={handleMarkAllRead} className="gap-2">
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read ({unreadCount})</span>
            </Button>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            filter === 'UNREAD'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filter === 'UNREAD' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'UNREAD' ? 'No unread notifications' : 'No notifications in your inbox'}
            description={
              filter === 'UNREAD'
                ? 'You are all caught up! There are no unread alerts.'
                : 'Business alerts, approval notices, and change updates will appear here.'
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNavigate(item)}
                className={`p-5 hover:bg-slate-50/80 cursor-pointer transition-colors flex items-start gap-4 ${
                  !item.is_read ? 'bg-teal-50/20' : ''
                }`}
              >
                <div
                  className={`w-3 h-3 mt-1.5 rounded-full shrink-0 ${
                    !item.is_read ? 'bg-primary ring-4 ring-teal-100' : 'bg-slate-200'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{item.title}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
                      {item.type.replace(/_/g, ' ')}
                    </span>
                    {!item.is_read && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span>{formatDate(item.created_at)}</span>
                    {item.link && (
                      <span className="text-primary hover:underline flex items-center gap-1 font-medium">
                        <span>Go to record</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!item.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleMarkOneRead(item.id, e)}
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4 text-slate-500 hover:text-primary" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDismiss(item.id, e)}
                    title="Dismiss"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

