import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function CompanyHeader() {
  const { companyId, isAdmin } = useCompany();
  
  const { data: settings } = useQuery({
    queryKey: ['company_settings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const company = settings?.[0];

  return (
    <div className="hidden lg:flex bg-slate-600 text-white px-6 py-4 items-center justify-between">
      <div className="flex items-center gap-4">
        {company?.logo_url ? (
          <img
            src={company.logo_url}
            alt="Logo"
            className="w-12 h-12 rounded-full object-contain bg-white p-1"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-500 flex items-center justify-center text-sm font-bold">
            {company?.company_name?.[0] || 'S'}
          </div>
        )}
        <div>
          <h2 className="font-bold text-lg">{company?.company_name || 'Société'}</h2>
          <p className="text-sm text-gray-200">{company?.email || ''}</p>
        </div>
      </div>

      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/parametres-societe">Paramètres société</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}