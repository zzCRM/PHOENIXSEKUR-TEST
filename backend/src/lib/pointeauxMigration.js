import { normalizeNfcTag, siteReservedTags } from '../../../shared/pointeaux.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const byId = (list) => new Map(list.map((item) => [item.id, item]));

export function analyze({ sites = [], rondes = [], executions = [], missions = [], pointeaux = [] }) {
  const sitesById = byId(sites);
  const rondesById = byId(rondes);
  const report = {
    totaux: { sites: sites.length, rondes: rondes.length, executions: executions.length, missions: missions.length, pointeaux: pointeaux.length, points: 0 },
    rondes_sans_site: [],
    rondes_site_inconnu: [],
    rondes_sans_societe: [],
    rondes_societe_differente_du_site: [],
    rondes_client_incoherent: [],
    points_sans_tag: [],
    points_site_different_de_la_ronde: [],
    points_id_en_double_dans_ronde: [],
    tags_en_double: { dans_une_ronde: [], meme_site: [], entre_sites: [], entre_societes: [] },
    tags_reserves_service: [],
    executions_ronde_inconnue: [],
    executions_points_non_tableau: [],
    executions_point_introuvable: [],
    missions_ronde_inconnue: [],
  };

  const tagUsages = new Map();
  for (const ronde of rondes) {
    const siteId = text(ronde.site_id);
    const site = sitesById.get(siteId);
    if (!siteId) report.rondes_sans_site.push({ ronde_id: ronde.id, name: ronde.name });
    else if (!site) report.rondes_site_inconnu.push({ ronde_id: ronde.id, name: ronde.name, site_id: siteId });
    else {
      if (site.company_id !== ronde.company_id) {
        report.rondes_societe_differente_du_site.push({ ronde_id: ronde.id, ronde_company: ronde.company_id, site_company: site.company_id });
      }
      if (ronde.client_id && site.client_id && ronde.client_id !== site.client_id) {
        report.rondes_client_incoherent.push({ ronde_id: ronde.id, ronde_client: ronde.client_id, site_client: site.client_id });
      }
    }
    if (!ronde.company_id) report.rondes_sans_societe.push({ ronde_id: ronde.id, name: ronde.name });

    const seenIds = new Set();
    const seenTags = new Set();
    for (const point of Array.isArray(ronde.checkpoints) ? ronde.checkpoints : []) {
      report.totaux.points += 1;
      const ref = { ronde_id: ronde.id, checkpoint_id: point.id, name: point.name };
      if (point.id !== undefined) {
        if (seenIds.has(point.id)) report.points_id_en_double_dans_ronde.push(ref);
        seenIds.add(point.id);
      }
      const tag = normalizeNfcTag(point.nfc_tag_id);
      if (!tag) {
        report.points_sans_tag.push(ref);
        continue;
      }
      if (seenTags.has(tag)) report.tags_en_double.dans_une_ronde.push({ ...ref, tag });
      seenTags.add(tag);
      if (point.site_id && siteId && point.site_id !== siteId) {
        report.points_site_different_de_la_ronde.push({ ...ref, point_site: point.site_id, ronde_site: siteId });
      }
      const usages = tagUsages.get(`${ronde.company_id || ''}|${tag}`) || [];
      usages.push({ ...ref, tag, company_id: ronde.company_id || '', site_id: siteId });
      tagUsages.set(`${ronde.company_id || ''}|${tag}`, usages);
    }
  }

  const tagsBySociete = new Map();
  for (const usages of tagUsages.values()) {
    const sitesTouched = new Set(usages.map((usage) => usage.site_id));
    const rondesTouched = new Set(usages.map((usage) => usage.ronde_id));
    if (sitesTouched.size > 1) report.tags_en_double.entre_sites.push({ tag: usages[0].tag, usages });
    else if (rondesTouched.size > 1) report.tags_en_double.meme_site.push({ tag: usages[0].tag, usages });
    const list = tagsBySociete.get(usages[0].tag) || new Set();
    list.add(usages[0].company_id);
    tagsBySociete.set(usages[0].tag, list);
  }
  for (const [tag, companies] of tagsBySociete) {
    if (companies.size > 1) report.tags_en_double.entre_societes.push({ tag, societes: [...companies] });
  }

  for (const site of sites) {
    const reserved = new Set(siteReservedTags(site));
    for (const usages of tagUsages.values()) {
      if (reserved.has(usages[0].tag) && usages[0].company_id === site.company_id) {
        report.tags_reserves_service.push({ site_id: site.id, tag: usages[0].tag, usages });
      }
    }
  }

  for (const execution of executions) {
    const ronde = rondesById.get(execution.ronde_id);
    const libre = execution.type === 'libre' || String(execution.ronde_id || '').startsWith('libre-');
    if (!libre && execution.ronde_id && !ronde) {
      report.executions_ronde_inconnue.push({ execution_id: execution.id, ronde_id: execution.ronde_id });
    }
    if (execution.checkpoints_done !== undefined && !Array.isArray(execution.checkpoints_done)) {
      report.executions_points_non_tableau.push({ execution_id: execution.id, valeur: execution.checkpoints_done });
      continue;
    }
    if (!ronde) continue;
    const known = new Set((ronde.checkpoints || []).map((point) => point.id));
    for (const done of execution.checkpoints_done || []) {
      if (!known.has(done.checkpoint_id)) {
        report.executions_point_introuvable.push({ execution_id: execution.id, ronde_id: ronde.id, checkpoint_id: done.checkpoint_id });
      }
    }
  }

  for (const mission of missions) {
    if (mission.ronde_id && !rondesById.has(mission.ronde_id)) {
      report.missions_ronde_inconnue.push({ mission_id: mission.id, ronde_id: mission.ronde_id });
    }
  }

  report.resume = Object.fromEntries(
    Object.entries(report)
      .filter(([key]) => !['totaux', 'resume', 'tags_en_double'].includes(key))
      .map(([key, value]) => [key, value.length])
      .concat([
        ['tags_en_double_dans_une_ronde', report.tags_en_double.dans_une_ronde.length],
        ['tags_en_double_meme_site', report.tags_en_double.meme_site.length],
        ['tags_en_double_entre_sites', report.tags_en_double.entre_sites.length],
        ['tags_en_double_entre_societes', report.tags_en_double.entre_societes.length],
      ]),
  );
  return report;
}

export function planMigration({ sites = [], rondes = [], pointeaux = [] }, decisions = {}) {
  const sitesById = byId(sites);
  const existingTags = new Map(pointeaux.filter((p) => p.status === 'actif' || p.status === 'inactif')
    .map((p) => [`${p.company_id}|${normalizeNfcTag(p.nfc_tag_id)}`, p]));
  const siteForRonde = (ronde) => text(ronde.site_id) || text(decisions.rondes_site?.[ronde.id]);

  const groups = new Map();
  const aCompleter = [];
  const aResoudre = [];

  for (const ronde of rondes) {
    const siteId = siteForRonde(ronde);
    const site = sitesById.get(siteId);
    if (!site || site.company_id !== ronde.company_id) {
      aResoudre.push({ type: 'ronde_sans_site_valide', ronde_id: ronde.id, name: ronde.name, site_id: siteId || null });
      continue;
    }
    for (const point of Array.isArray(ronde.checkpoints) ? ronde.checkpoints : []) {
      const ref = { ronde_id: ronde.id, checkpoint_id: point.id, name: point.name };
      const tag = normalizeNfcTag(point.nfc_tag_id);
      if (!tag) {
        aCompleter.push({ ...ref, site_id: site.id });
        continue;
      }
      if (point.site_id && point.site_id !== site.id) {
        aResoudre.push({ type: 'point_site_different', ...ref, point_site: point.site_id, ronde_site: site.id });
        continue;
      }
      const key = `${ronde.company_id}|${tag}`;
      const group = groups.get(key) || { company_id: ronde.company_id, tag, sites: new Map(), refs: [] };
      const siteGroup = group.sites.get(site.id) || [];
      siteGroup.push({ ...ref, point });
      group.sites.set(site.id, siteGroup);
      groups.set(key, group);
    }
  }

  const aCreer = [];
  const dejaPresents = [];
  for (const [key, group] of groups) {
    let siteId;
    if (group.sites.size === 1) siteId = [...group.sites.keys()][0];
    else {
      siteId = text(decisions.tags?.[group.tag]);
      if (!siteId || !group.sites.has(siteId)) {
        aResoudre.push({ type: 'tag_sur_plusieurs_sites', tag: group.tag, sites: [...group.sites.keys()] });
        continue;
      }
    }
    const refs = [...group.sites.get(siteId)];
    const reference = refs[0].point;
    const legacy_refs = refs.map(({ ronde_id, checkpoint_id }) => ({ ronde_id, checkpoint_id }));
    const existing = existingTags.get(key);
    if (existing) {
      dejaPresents.push({ pointeau_id: existing.id, tag: group.tag, legacy_refs });
      continue;
    }
    const site = sitesById.get(siteId);
    aCreer.push({
      company_id: group.company_id,
      site_id: siteId,
      status: 'actif',
      name: text(reference.name) || `Point ${group.tag}`,
      description: reference.description || '',
      nfc_tag_id: text(reference.nfc_tag_id),
      latitude: reference.latitude ?? null,
      longitude: reference.longitude ?? null,
      photo_url: reference.photo_url || '',
      client_id: site.client_id || '',
      client_name: site.client_name || '',
      site_name: site.name || '',
      legacy_refs,
      migre_depuis: 'rondes',
    });
  }

  return {
    a_creer: aCreer,
    deja_presents: dejaPresents,
    a_completer_sans_tag: aCompleter,
    a_resoudre_manuellement: aResoudre,
    resume: {
      pointeaux_a_creer: aCreer.length,
      deja_presents: dejaPresents.length,
      points_sans_tag_non_migres: aCompleter.length,
      cas_a_resoudre: aResoudre.length,
    },
  };
}
