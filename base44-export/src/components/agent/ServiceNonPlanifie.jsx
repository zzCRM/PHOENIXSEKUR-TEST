import { UNPLANNED_SERVICE_TYPES } from '@/lib/agentPortal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

export default function ServiceNonPlanifie({ sites = [], onStart }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Débuter un service non planifié</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez le type de service puis le site. La prise de service lance le chrono.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {UNPLANNED_SERVICE_TYPES.map((type) => (
          <Card key={type.key} className="p-3 space-y-2">
            <p className="font-semibold text-sm uppercase tracking-wide">{type.label}</p>
            {sites.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun site affecté.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sites.map((site) => (
                  <Button
                    key={`${type.key}-${site.id}`}
                    variant="secondary"
                    className="justify-start h-auto py-2 whitespace-normal text-left"
                    onClick={() => {
                      const now = format(new Date(), 'HH:mm');
                      onStart({
                        id: `unplanned-${type.key}-${site.id}`,
                        unplanned: true,
                        type: type.key,
                        title: type.label,
                        site_id: site.id,
                        site_name: site.name || site.site_name,
                        client_name: site.client_name,
                        start_time: now,
                        end_time: '',
                      });
                    }}
                  >
                    {site.name || site.site_name}
                    {site.address ? ` — ${site.address}` : ''}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
