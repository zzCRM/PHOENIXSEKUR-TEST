import React from 'react';
import { AlertTriangle, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_LINKS = {
  weekly_legal: { label: 'Code trav. durée légale 35h', url: 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000006189630' },
  weekly_max: { label: 'Code trav. art. L3121-20', url: 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000006189630' },
  daily_max: { label: 'Code trav. art. L3121-19', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020422' },
  daily_rest: { label: 'Code trav. art. L3131-1', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020918' },
  weekly_rest: { label: 'Code trav. art. L3132-2', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006902581' },
  night_daily_max: { label: 'Code trav. art. L3122-6', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035653023' },
  night_weekly_max: { label: 'Code trav. art. L3122-7', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020165' },
};

function SourceLink({ type, source }) {
  const s = source || SOURCE_LINKS[type];
  if (!s) return null;
  return (
    <a href={s.url} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-0.5 text-[10px] underline opacity-80 hover:opacity-100 mt-0.5">
      <ExternalLink className="w-2.5 h-2.5" /> {s.label}
    </a>
  );
}

export default function ComplianceAlerts({ violations }) {
  if (!violations || violations.length === 0) return null;
  const urgent = violations.filter(v => v.severity === 'urgent');
  const attention = violations.filter(v => v.severity === 'attention');
  return (
    <div className="space-y-2">
      {urgent.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            NON-CONFORMITÉ CODE DU TRAVAIL ({urgent.length})
          </div>
          {urgent.map((v, i) => (
            <div key={i} className="flex items-start gap-1.5 text-red-700 text-xs pl-1">
              <span className="text-red-400 mt-0.5">•</span>
              <div className="flex flex-col">
                <span>{v.message}</span>
                <SourceLink type={v.type} source={v.source} />
              </div>
            </div>
          ))}
        </div>
      )}
      {attention.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
            <Clock className="w-3.5 h-3.5" />
            POINTS D'ATTENTION ({attention.length})
          </div>
          {attention.map((v, i) => (
            <div key={i} className="flex items-start gap-1.5 text-amber-700 text-xs pl-1">
              <span className="text-amber-400 mt-0.5">•</span>
              <div className="flex flex-col">
                <span>{v.message}</span>
                <SourceLink type={v.type} source={v.source} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComplianceBadge({ violations }) {
  if (!violations || violations.length === 0) {
    return (
      <div className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
        <ShieldCheck className="w-3.5 h-3.5" /> Conforme
      </div>
    );
  }
  const urgent = violations.filter(v => v.severity === 'urgent').length;
  return (
    <div className={cn(
      "inline-flex items-center gap-1 text-xs font-medium",
      urgent > 0 ? "text-red-600" : "text-amber-600"
    )}>
      <AlertTriangle className="w-3.5 h-3.5" /> {violations.length} alerte(s)
    </div>
  );
}