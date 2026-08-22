import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, AlertTriangle, Shield, MapPin, Clock, User, Timer, Wifi } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';

const TYPE_CONFIG = {
  debut_service: { label: 'Prise de service', icon: Shield, color: 'text-green-600 bg-green-50 border-green-200' },
  fin_service: { label: 'Fin de service', icon: Shield, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  debut_ronde: { label: 'Début ronde', icon: MapPin, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  fin_ronde: { label: 'Fin ronde', icon: MapPin, color: 'text-purple-700 bg-purple-100 border-purple-300' },
  pti_alerte: { label: 'PTI ALERTE', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-300' },
  pti_ok: { label: 'PTI OK', icon: Shield, color: 'text-green-600 bg-green-50 border-green-200' },
  incident: { label: 'Incident', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  geofence: { label: 'Hors zone', icon: MapPin, color: 'text-red-600 bg-red-50 border-red-300' },
};

const SEVERITY_BORDER = {
  info: '',
  attention: 'border-l-4 border-l-amber-400',
  urgent: 'border-l-4 border-l-red-500',
};

export default function Alertes() {
  const [filter, setFilter] = useState('all');
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const { data: alertes = [] } = useQuery({
    queryKey: ['alertes', companyId],
    queryFn: () => base44.entities.Alerte.filter({ company_id: companyId }, '-created_date', 200),
    enabled: !!companyId,
    refetchInterval: 15000,
  });

  const markReadMut = useMutation({
    mutationFn: (id) => base44.entities.Alerte.update(id, { read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertes'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: async () => {
      const unread = alertes.filter(a => !a.read);
      await Promise.all(unread.map(a => base44.entities.Alerte.update(a.id, { read: true })));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertes'] }),
  });

  const TABS = [
    { key: 'all', label: 'Toutes', types: null },
    { key: 'service', label: 'Prise de service', types: ['debut_service', 'fin_service'] },
    { key: 'rondes', label: 'Rondes', types: ['debut_ronde', 'fin_ronde'] },
    { key: 'incidents', label: 'Incidents', types: ['incident', 'geofence', 'pti_alerte', 'pti_ok'] },
    { key: 'unread', label: 'Non lues', types: null },
    { key: 'urgent', label: 'Urgentes', types: null },
  ];

  const filtered = alertes.filter(a => {
    const tab = TABS.find(t => t.key === filter);
    if (filter === 'unread') return !a.read;
    if (filter === 'urgent') return a.severity === 'urgent';
    if (tab?.types) return tab.types.includes(a.type);
    return true;
  });

  const unreadCount = alertes.filter(a => !a.read).length;
  const urgentCount = alertes.filter(a => a.severity === 'urgent' && !a.read).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Alertes & Notifications
            {unreadCount > 0 && <Badge className="bg-red-500 text-white">{unreadCount}</Badge>}
          </h1>
          <p className="text-muted-foreground mt-1">Centre de notifications en temps réel · actualisation auto toutes les 15s</p>
        </div>
        <div className="flex gap-2">
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{urgentCount} alerte(s) urgente(s)</span>
            </div>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" onClick={() => markAllReadMut.mutate()} className="gap-2">
              <CheckCheck className="w-4 h-4" /> Tout marquer lu
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Prises de service', types: ['debut_service'], icon: Shield, color: 'text-green-600 bg-green-50' },
          { label: 'Rondes démarrées', types: ['debut_ronde'], icon: MapPin, color: 'text-purple-600 bg-purple-50' },
          { label: 'Rondes terminées', types: ['fin_ronde'], icon: Timer, color: 'text-blue-600 bg-blue-50' },
          { label: 'Incidents', types: ['incident', 'pti_alerte', 'geofence'], icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
        ].map(card => {
          const count = alertes.filter(a => card.types.includes(a.type)).length;
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}><Icon className="w-4 h-4" /></div>
              <div>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              {t.key === 'unread' && unreadCount > 0 && <Badge className="ml-1 bg-red-500 text-white text-xs px-1 py-0 h-4">{unreadCount}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune alerte dans cette catégorie</p>
          </div>
        )}
        {filtered.map(alerte => {
          const config = TYPE_CONFIG[alerte.type] || TYPE_CONFIG.debut_service;
          const Icon = config.icon;
          return (
            <Card
              key={alerte.id}
              className={`p-4 transition-all cursor-pointer hover:shadow-md ${SEVERITY_BORDER[alerte.severity] || ''} ${!alerte.read ? 'bg-muted/30' : ''}`}
              onClick={() => !alerte.read && markReadMut.mutate(alerte.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg border shrink-0 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
                    {alerte.severity === 'urgent' && <Badge className="bg-red-500 text-white text-xs">URGENT</Badge>}
                    {!alerte.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm font-medium">{alerte.message}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {alerte.agent_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{alerte.agent_name}</span>}
                    {alerte.site_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{alerte.site_name}</span>}
                    {alerte.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{alerte.date} {alerte.time}</span>}
                    {alerte.latitude && (
                      <a href={`https://maps.google.com/?q=${alerte.latitude},${alerte.longitude}`} target="_blank" rel="noopener noreferrer"
                        className="text-primary underline" onClick={e => e.stopPropagation()}>
                        Voir sur carte
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}