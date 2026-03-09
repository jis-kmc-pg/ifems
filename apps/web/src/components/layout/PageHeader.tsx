import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: string;
  breadcrumbs?: Breadcrumb[];
}

export default function PageHeader({ title, description, actions, badge, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 mb-1">
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight size={12} className="text-gray-400" />}
                  {crumb.path ? (
                    <Link to={crumb.path} className="text-xs text-gray-500 dark:text-gray-400 hover:text-[#E94560] dark:hover:text-[#27AE60] transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{crumb.label}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h1>
            {badge && (
              <span className="px-2 py-0.5 text-xs font-medium bg-[#27AE60] text-white rounded">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
