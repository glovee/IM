import { useState } from 'react';
import { AlertCircle, Settings, ChevronLeft, ChevronRight, User, BarChart3, Trash2, AlertTriangle, PanelsTopLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const menuItems = [
    { id: 'incidents', label: 'Инциденты', icon: AlertCircle, path: '/' },
    { id: 'my-incidents', label: 'Мои инциденты', icon: User, path: '/my-incidents' },
    { id: 'violators', label: 'Нарушители', icon: AlertTriangle, path: '/violators' },
    { id: 'boards', label: 'Доски', icon: PanelsTopLeft, path: '/boards' },
    { id: 'dashboard', label: 'Дашборд', icon: BarChart3, path: '/dashboard' },
    { id: 'trash', label: 'Корзина', icon: Trash2, path: '/trash' }
  ];

  return (
    <div
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300`}
    >
      <div className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-2">
        {!isCollapsed && (
          <>
            <div className="text-xs text-gray-500 dark:text-gray-400 px-3">Версия: 1.0.0</div>
            <Link
              to="/settings"
              className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm"
            >
              <Settings className="w-5 h-5" />
              <span>Настройки</span>
            </Link>
          </>
        )}
        {isCollapsed && (
          <Link
            to="/settings"
            className="w-full flex items-center justify-center py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
