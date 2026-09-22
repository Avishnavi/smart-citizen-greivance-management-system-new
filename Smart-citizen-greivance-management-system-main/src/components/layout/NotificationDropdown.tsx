import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock, CheckCircle2, AlertTriangle, ChevronRight, X } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose
}) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleNotificationClick = (id: string, complaintId?: string) => {
    markAsRead(id);
    onClose();
    if (complaintId) {
      navigate(`/track?id=${complaintId}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'assigned':
      case 'status_change':
        return <Clock className="w-4 h-4 text-sky-600" />;
      case 'announcement':
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
  };

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' +
             date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <>
      {/* Backdrop for click outside */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>

      <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-700" />
            <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold bg-sky-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No notifications yet
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif.id, notif.complaintId)}
                className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start ${
                  !notif.read ? 'bg-sky-50/50' : ''
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-100 mt-0.5 flex-shrink-0">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-semibold truncate ${!notif.read ? 'text-slate-900' : 'text-slate-700'}`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-sky-600 flex-shrink-0"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{formatTime(notif.timestamp)}</span>
                    {notif.complaintId && (
                      <span className="text-sky-600 font-medium flex items-center gap-0.5">
                        Track <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={() => {
              onClose();
              navigate('/track');
            }}
            className="text-xs font-semibold text-sky-700 hover:text-sky-900"
          >
            View Active Complaint Tracker →
          </button>
        </div>
      </div>
    </>
  );
};
