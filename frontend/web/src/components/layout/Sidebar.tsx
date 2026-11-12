import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RoleName } from '../../types';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Box,
  Tag,
  Layers,
  ClipboardList,
  GitPullRequest,
  Bell,
  CheckSquare,
  Users,
  Settings,
  ShieldCheck,
  ChevronRight,
  Truck,
  ShoppingCart,
  Archive,
  Factory,
  ShieldAlert,
  FileBarChart,
  BellRing,
} from 'lucide-react';

export function Sidebar() {
  const { hasRole, hasPermission } = useAuth();

  const allNavItems: {
    name: string;
    href: string;
    icon: any;
    exact?: boolean;
    permission?: string;
    role?: RoleName;
  }[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: 'Categories', href: '/categories', icon: Tag, permission: 'product:read' },
    { name: 'Products', href: '/products', icon: Box, permission: 'product:read' },
    { name: 'Bills of Materials', href: '/boms', icon: Layers, permission: 'bom:read' },
    { name: 'Change Requests (ECR)', href: '/ecrs', icon: ClipboardList, permission: 'ecr:read' },
    { name: 'Change Orders (ECO)', href: '/ecos', icon: GitPullRequest, permission: 'eco:read' },
    { name: 'Change Notices (ECN)', href: '/ecns', icon: Bell, permission: 'ecn:read' },
    { name: 'Suppliers', href: '/suppliers', icon: Truck, permission: 'supplier:read' },
    { name: 'Purchasing', href: '/purchasing', icon: ShoppingCart, permission: 'purchasing:read' },
    { name: 'Inventory & Stock', href: '/inventory', icon: Archive, permission: 'inventory:read' },
    { name: 'Manufacturing (WO)', href: '/manufacturing', icon: Factory, permission: 'manufacturing:read' },
    { name: 'Quality & NCR', href: '/quality', icon: ShieldAlert, permission: 'quality:read' },
    { name: 'Reports & Analytics', href: '/reports', icon: FileBarChart, permission: 'reports:read' },
    { name: 'Notifications', href: '/notifications', icon: BellRing },
    { name: 'Approvals', href: '/approvals', icon: CheckSquare, permission: 'approvals:read' },
    { name: 'Users & Roles', href: '/users', icon: Users, permission: 'user:read' },
    { name: 'System Admin', href: '/admin', icon: Settings, permission: 'admin:all' },
  ];

  const navigation = allNavItems.filter((item) => {
    if (hasRole('ADMINISTRATOR') || hasPermission('admin:all')) return true;
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.role && !hasRole(item.role)) return false;
    return true;
  });

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen text-slate-300">
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold tracking-wider text-sm shadow">
          EF
        </div>
        <div>
          <span className="font-bold text-base text-white tracking-tight">ECOFlow</span>
          <span className="block text-[10px] text-teal-400 font-semibold uppercase tracking-wider">PLM Platform</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.exact}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              )
            }
          >
            <item.icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
            <span className="flex-1">{item.name}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-medium text-slate-400">Enterprise Edition</span>
        </div>
        <p>ECOFlow Core v1.0.0</p>
      </div>
    </aside>
  );
}

