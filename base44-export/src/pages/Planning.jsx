import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/lib/useCompany';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import StatusBadge from '@/components/shared/StatusBadge';

const typeColors = {
  gardiennage: 'bg-primary/15 border-l-primary text-primary',
  surveillance: 'bg-blue-500/15 border-l-blue-500 text-blue-700',
  intervention: 'bg-amber-500/15 border-l-amber-500 text-amber-700',
  ronde: 'bg-purple-500/15 border-l-purple-500 text-purple-700',
  evenementiel: 'bg-pink-500/15 border-l-pink-500 text-pink-700',
};

export default function Planning() {
  const { companyId } = useCompany();
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: missions = [] } = useQuery({ queryKey: ['missions', companyId], queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 200), enabled: !!companyId });

  const missionsByDate = useMemo(() => {
    const map = {};
    missions.forEach(m => {
      if (m.date) {
        const key = m.date.split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push(m);
      }
    });
    return map;
  }, [missions]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground mt-1">Semaine du {format(weekStart, 'd MMMM yyyy', { locale: fr })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Aujourd'hui</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayMissions = missionsByDate[dateKey] || [];
          const isToday = isSameDay(day, new Date());

          return (
            <Card key={dateKey} className={`p-3 min-h-[160px] ${isToday ? 'ring-2 ring-primary/40' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {format(day, 'EEE', { locale: fr })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </p>
                </div>
                {dayMissions.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{dayMissions.length}</Badge>
                )}
              </div>
              <div className="space-y-1.5">
                {dayMissions.map(m => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-md border-l-3 text-xs ${typeColors[m.type] || 'bg-muted border-l-border'}`}
                  >
                    <p className="font-medium truncate">{m.title}</p>
                    {m.start_time && (
                      <p className="opacity-70 mt-0.5">{m.start_time}{m.end_time ? ` - ${m.end_time}` : ''}</p>
                    )}
                    {m.agent_name && <p className="opacity-60 truncate mt-0.5">{m.agent_name}</p>}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-muted-foreground">
        <span className="font-medium">Légende :</span>
        {Object.entries(typeColors).map(([type, cls]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${cls.split(' ')[0]}`} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}