import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CompanyHeader from './CompanyHeader';
import { cn } from '@/lib/utils';
import RGPDConsent from '@/components/rgpd/RGPDConsent';
import { Menu, Search, Bell, User } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar - fixed */}
      <aside className={cn(
        "fixed left-0 top-0 h-screen z-50 transition-all duration-300 hidden lg:block",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-screen w-[280px] z-50 transition-transform duration-300 lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar collapsed={false} setCollapsed={() => {}} onMobileClose={() => setMobileOpen(false)} />
      </aside>

      {/* Main content area */}
      <div className={cn(
        "min-h-screen transition-all duration-300",
        collapsed ? "lg:ml-[72px]" : "lg:ml-[240px]"
      )}>
        {/* Mobile top bar - style PhoenixCRM */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2 px-4 py-3">
            {/* Menu burger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>

            {/* Search bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-0 rounded-full text-sm focus-visible:ring-1"
              />
            </div>

            {/* Notifications */}
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
              <Bell className="w-5 h-5 text-gray-700" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">1</span>
            </button>

            {/* User avatar */}
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <User className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </header>

        {/* Desktop company header */}
        <CompanyHeader />

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      <RGPDConsent />
    </div>
  );
}