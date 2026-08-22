import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Users, X, Radio, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, subMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import SupervisionMap from '@/components/supervision/SupervisionMap';

export default function CarteTempsReel() {
  const { companyId } = useCompany();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [panelOpen, setPanelOpen] = useState(true);

  const { data: geoPoints = [], refetch, isFetching } = useQuery({
    queryKey: ['geolocation', companyId, today],
    queryFn: () => base44.entities.Geolocation.filter({ company_id: companyId, date: today }, '-timestamp', 200),
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['prises_service', companyId, today],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId, date: today }, '-created_date', 200),
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }, '-created_date', 500),
    enabled: !!companyId,
  });

  const { data: companySettings } = useQuery({
    queryKey: ['company_settings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }, '-updated_date', 1),
    enabled: !!companyId,
  });

  const hqAddress = companySettings?.[0]
    ? [companySettings[0].address, companySettings[0].postal_code, companySettings[0].city].filter(Boolean).join(', ')
    : '';

  // Group by agent - last position only
  const agentPositions = {};
  geoPoints.forEach(p => {
    if (!agentPositions[p.agent_id] || p.timestamp > agentPositions[p.agent_id].timestamp) {
      agentPositions[p.agent_id] = p;
    }
  });

  const activeServices = services.filter(s => s.status === 'en_service');
  const isRecent = (ts) => ts && new Date(ts) > subMinutes(new Date(), 5);
  const onlineCount = activeServices.filter(s => {
    const p = agentPositions[s.agent_id];
    return p && isRecent(p.timestamp);
  }).length;

  return (
    <div className="relative h-[calc(100vh-100px)] min-h-[480px] -mx-4 -mb-6 sm:-mx-6 overflow-hidden rounded-none sm:rounded-xl sm:overflow-hidden sm:border sm:border-border">
      <SupervisionMap
        hqAddress={hqAddress}
        positions={Object.values(agentPositions)}
        agentPositions={agentPositions}
        sites={sites}
        services={services}
      />

      {/* Top-left overlay: title + agent count */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur shadow-lg rounded-xl px-4 py-2.5 border border-border/60 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <h1 className="text-base font-bold tracking-tight">Supervision</h1>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Temps réel — {today}</p>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur shadow-lg rounded-xl px-3 py-2 border border-border/60 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold">{activeServices.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">en service</div>
            </div>
          </div>
          <div className="bg-white/95 backdrop-blur shadow-lg rounded-xl px-3 py-2 border border-border/60 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold">{onlineCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">en ligne</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top-right overlay: refresh */}
      <div className="absolute top-3 right-3 z-[1000] pointer-events-auto">
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2 bg-white/95 backdrop-blur shadow-lg">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>

      {/* Right floating panel: agents list */}
      {activeServices.length > 0 && (
        <div className={`absolute top-20 right-3 z-[1000] transition-transform duration-300 ${panelOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'}`}>
          <div className="w-72 max-h-[calc(100vh-180px)] bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-border/60 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Agents ({activeServices.length})
              </span>
              <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-1.5">
              {activeServices.map(svc => {
                const p = agentPositions[svc.agent_id];
                const recent = p ? isRecent(p.timestamp) : false;
                return (
                  <div key={svc.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${recent ? 'bg-green-500' : p ? 'bg-amber-500' : 'bg-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{svc.agent_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{svc.site_name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Depuis {svc.actual_start || '—'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!panelOpen && activeServices.length > 0 && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute top-20 right-3 z-[1000] bg-white/95 backdrop-blur shadow-lg rounded-full w-10 h-10 flex items-center justify-center border border-border/60"
        >
          <Users className="w-4 h-4 text-primary" />
        </button>
      )}

      {/* Legend bottom-left */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-white/95 backdrop-blur shadow-lg rounded-lg px-3 py-2 border border-border/60 pointer-events-auto">
        <div className="flex flex-col gap-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 inline-flex items-center justify-center"><svg width="14" height="17" viewBox="0 0 34 42"><circle cx="17" cy="9" r="6.5" fill="#F4D03F" stroke="#1f2937"/><path d="M6 38c0-7.7 4.6-13 11-13s11 5.3 11 13" fill="#F4D03F" stroke="#1f2937"/></svg></span>
            <span className="text-slate-600">Agent en service</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex"><svg width="12" height="16" viewBox="0 0 34 44"><path d="M17 1C9.3 1 3 7.1 3 14.6 3 24.5 17 43 17 43s14-18.5 14-28.4C31 7.1 24.7 1 17 1z" fill="#0f766e" stroke="#fff" stroke-width="2"/></svg></span>
            <span className="text-slate-600">Site (nb agents)</span>
          </div>
        </div>
      </div>
    </div>
  );
}