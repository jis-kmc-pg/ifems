import { NavLink, useLocation } from 'react-router-dom';
import { SIDEBAR_MENUS, type GnbMenuId, type SidebarEntry } from '../../lib/constants';
import { useUiStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';

function getActiveGnbMenu(pathname: string): GnbMenuId {
  const segment = pathname.split('/')[1] as GnbMenuId;
  return (segment in SIDEBAR_MENUS ? segment : 'monitoring') as GnbMenuId;
}

function renderEntry(entry: SidebarEntry, i: number) {
  if ('group' in entry) {
    return (
      <div
        key={`g-${entry.group}`}
        className={cn(
          'px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500',
          i > 0 && 'mt-2 border-t border-gray-100 dark:border-gray-700 pt-2',
        )}
      >
        {entry.group}
      </div>
    );
  }
  return (
    <NavLink
      key={entry.id}
      to={entry.path}
      className={({ isActive }) =>
        cn(
          'flex items-center px-4 py-2.5 text-sm whitespace-nowrap transition-colors',
          isActive
            ? 'bg-[#E94560] dark:bg-[#E94560] text-white font-medium'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
        )
      }
    >
      {entry.label}
    </NavLink>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed } = useUiStore();
  const activeGnb = getActiveGnbMenu(location.pathname);
  const menus = SIDEBAR_MENUS[activeGnb] ?? [];

  return (
    <aside
      className={cn(
        'sidebar-transition flex-shrink-0 bg-white dark:bg-[#16213E] border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden',
        sidebarCollapsed ? 'w-0' : 'w-[200px]'
      )}
    >
      <nav className="flex-1 overflow-y-auto py-3">
        {menus.map((entry, i) => renderEntry(entry, i))}
      </nav>

      {/* 버전 정보 */}
      <div className="p-3 text-[10px] text-gray-400 dark:text-gray-600 whitespace-nowrap border-t border-gray-100 dark:border-gray-700">
        i-FEMS v1.0.0
      </div>
    </aside>
  );
}
