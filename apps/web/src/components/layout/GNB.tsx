import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Monitor, Menu, Bell, User, LogOut } from 'lucide-react';
import { GNB_MENUS, APP_NAME, APP_SUBTITLE } from '../../lib/constants';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';

function getActiveMenu(pathname: string) {
  const segment = pathname.split('/')[1];
  return segment || 'monitoring';
}

export default function GNB() {
  const location = useLocation();
  const activeMenu = getActiveMenu(location.pathname);
  const { theme, setTheme, toggleSidebar } = useUiStore();
  const { user, logout } = useAuthStore();

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;

  return (
    <header className="h-14 bg-[#1A1A2E] dark:bg-[#0F1419] flex items-center px-4 gap-4 z-50 shadow-lg flex-shrink-0">
      {/* 사이드바 토글 */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
        aria-label="사이드바 토글"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* 로고 */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-8 h-8 bg-[#E94560] rounded-lg flex items-center justify-center text-white font-bold text-xs">
          i-F
        </div>
        <div className="hidden sm:block">
          <div className="text-white font-bold text-sm leading-none">{APP_NAME}</div>
          <div className="text-white/50 text-[10px] leading-none mt-0.5">{APP_SUBTITLE}</div>
        </div>
      </div>

      {/* GNB 메뉴 */}
      <nav className="flex items-center gap-1 flex-1">
        {GNB_MENUS.map((menu) => (
          <Link
            key={menu.id}
            to={menu.path}
            className={cn(
              'px-4 py-2 rounded text-sm font-medium transition-colors',
              activeMenu === menu.id
                ? 'bg-[#E94560] text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            )}
          >
            {menu.label}
          </Link>
        ))}
      </nav>

      {/* 우측 액션 */}
      <div className="flex items-center gap-2">
        {/* 알림 */}
        <button className="relative p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors" aria-label="알림">
          <Bell size={18} aria-hidden="true" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#E94560] rounded-full" aria-hidden="true" />
        </button>

        {/* 다크모드 토글 */}
        <button
          onClick={cycleTheme}
          className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          aria-label={`테마 변경: 현재 ${theme === 'dark' ? '다크' : theme === 'light' ? '라이트' : '시스템'} 모드`}
        >
          <ThemeIcon size={18} aria-hidden="true" />
        </button>

        {/* 사용자 정보 */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/20">
          <div className="flex items-center gap-1.5 text-white/70 text-sm">
            <User size={16} aria-hidden="true" />
            <span className="hidden md:inline">{user?.name ?? '관리자'}</span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            aria-label="로그아웃"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
