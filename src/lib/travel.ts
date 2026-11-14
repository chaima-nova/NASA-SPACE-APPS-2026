/**
 * Getting there.
 *
 * The brief asks two things of the logistics side: whether a site can be
 * reached by commercial travel at all, and what a field party's options look
 * like once it can. Nothing here calls a flight API — the shell has no backend
 * and no key — so the journey is modelled from data the app does hold:
 *
 *   * real airports, at their real coordinates, are the gate for each site;
 *   * the onward leg to the site is measured from the gate as a distance, and
 *     given a mode by how far it is;
 *   * air time and fare are modelled from the air distance.
 *
 * Every time- and price-shaped number here is an estimate and is labelled as
 * one wherever it appears. Each itinerary also carries a live Google Flights
 * link for its route, so a reader can check the day's real availability rather
 * than trust a figure this file produced. That link is how "check Google" is
 * honoured without shipping an API key in the bundle.
 */

import type { Table } from './export';
import { distanceKm, type Origin } from './geo';

/** Real airports, real coordinates. These are the gates to the analog sites. */
interface Gateway {
  /** IATA code — the thing a flight search actually understands. */
  code: string;
  name: string;
  lat: number;
  lon: number;
  /** True where the service is seasonal or chartered rather than year-round. */
  seasonal?: boolean;
}

const GATEWAYS: Gateway[] = [
  { code: 'CJC', name: 'El Loa, Calama', lat: -22.5, lon: -68.9 },
  { code: 'ANF', name: 'Andrés Sabella, Antofagasta', lat: -23.44, lon: -70.44 },
  { code: 'YRB', name: 'Resolute Bay', lat: 74.72, lon: -94.97, seasonal: true },
  { code: 'YFB', name: 'Iqaluit', lat: 63.75, lon: -68.52 },
  { code: 'LAS', name: 'Harry Reid, Las Vegas', lat: 36.08, lon: -115.15 },
  { code: 'PMD', name: 'Palmdale Regional', lat: 34.63, lon: -118.08 },
  { code: 'LAX', name: 'Los Angeles International', lat: 33.94, lon: -118.41 },
  { code: 'CHC', name: 'Christchurch', lat: -43.49, lon: 172.53, seasonal: true },
  { code: 'KOA', name: 'Kona, Ellison Onizuka', lat: 19.74, lon: -156.05 },
  { code: 'ITO', name: 'Hilo', lat: 19.72, lon: -155.05 },
  { code: 'SVQ', name: 'Sevilla', lat: 37.42, lon: -5.9 },
  { code: 'ACE', name: 'Lanzarote, César Manrique', lat: 28.95, lon: -13.6 },
  { code: 'BOI', name: 'Boise', lat: 43.56, lon: -116.22 },
  { code: 'IDA', name: 'Idaho Falls Regional', lat: 43.51, lon: -112.07 },
  { code: 'MFR', name: 'Rogue Valley, Medford', lat: 42.37, lon: -122.87 },
  { code: 'LMT', name: 'Klamath Falls', lat: 42.16, lon: -121.73 },
  { code: 'XNN', name: 'Xining Caojiabao', lat: 36.53, lon: 102.04 },
  { code: 'GOQ', name: 'Golmud', lat: 36.4, lon: 94.9 },
  { code: 'AEY', name: 'Akureyri', lat: 65.66, lon: -18.07 },
  { code: 'EGS', name: 'Egilsstaðir', lat: 65.28, lon: -14.4 },
  { code: 'REK', name: 'Reykjavík, Keflavík', lat: 63.99, lon: -22.62 },
];

type Place = { lat: number; lon: number };

/** How a site is served: year-round flights, charter only, or expedition. */
export type Access = 'scheduled' | 'charter' | 'none';

export interface TravelAccess {
  access: Access;
  gateway: Gateway | null;
  /** Distance from the gate airport to the site, in kilometres. */
  transferKm: number;
  /** What that last leg is: a road drive, an off-road transfer, a charter. */
  transferMode: string;
  note: string;
}

/**
 * Onward leg from the gate. Below 150 km a road is assumed, further than that
 * the terrain these sites sit in stops being drivable, and past 1,200 km the
 * only honest description is a charter flight or a ship.
 */
function onwardMode(km: number, lat: number): string {
  if (lat < -55) return 'Ice flight or ship';
  if (km <= 150) return 'Road transfer';
  if (km <= 1200) return 'Off-road transfer';
  return 'Charter flight';
}

const onwardSpeed = (mode: string) => {
  if (mode === 'Road transfer') return 70;
  if (mode === 'Off-road transfer') return 35;
  return 240;
};

/** The nearest gate, and whether reaching this site commercially is realistic. */
export function travelAccessOf(site: Place): TravelAccess {
  let best: { gateway: Gateway; km: number } | null = null;
  for (const gateway of GATEWAYS) {
    const km = distanceKm(gateway, site);
    if (!best || km < best.km) best = { gateway, km };
  }

  if (!best) {
    return {
      access: 'none',
      gateway: null,
      transferKm: 0,
      transferMode: '—',
      note: 'No airport is on file for this site.',
    };
  }

  const { gateway, km } = best;
  const mode = onwardMode(km, site.lat);
  const rounded = Math.round(km);

  if (gateway.seasonal || km > 600) {
    if (km > 4500) {
      return {
        access: 'none',
        gateway,
        transferKm: km,
        transferMode: mode,
        note: `${gateway.code} is ${rounded.toLocaleString('en-US')} km away — beyond what commercial travel reaches. Expedition logistics only.`,
      };
    }
    return {
      access: 'charter',
      gateway,
      transferKm: km,
      transferMode: mode,
      note: `${gateway.code} ${gateway.name} is the nearest gate, ${rounded.toLocaleString(
        'en-US',
      )} km out. The last leg needs a ${mode.toLowerCase()}.`,
    };
  }

  return {
    access: 'scheduled',
    gateway,
    transferKm: km,
    transferMode: mode,
    note: `Scheduled service into ${gateway.code} ${gateway.name}, then a ${mode.toLowerCase()} of ${rounded.toLocaleString(
      'en-US',
    )} km.`,
  };
}

export const ACCESS_LABELS: Record<Access, string> = {
  scheduled: 'Commercial travel available',
  charter: 'Charter needed',
  none: 'No commercial access',
};

export interface Leg {
  from: string;
  to: string;
  /** Plain-language mode, e.g. "Direct flight" or "Off-road transfer". */
  mode: string;
  hours: number;
  costUsd: number;
}

export interface Itinerary {
  kind: 'fastest' | 'cheapest';
  label: string;
  legs: Leg[];
  hours: number;
  costUsd: number;
  /** Live route search for the air leg. */
  flightsUrl: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Modelled door-to-door fare for a leg, in USD. Not a quote. */
const airFare = (km: number) => Math.round(120 + km * 0.09);

const onwardFare = (km: number, mode: string) =>
  mode === 'Road transfer' || mode === 'Off-road transfer'
    ? Math.round(40 + km * 0.9)
    : Math.round(160 + km * 0.55);

/** Google Flights search for the route into a gate airport. */
export function flightsUrl(code: string): string {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${code}`)}`;
}

/**
 * The two itineraries a field party actually chooses between: the quickest way
 * there, and the cheapest. One air leg each (the cheapest one stops, and pays
 * for it in hours) plus the onward transfer from the gate.
 *
 * Returns null when the site cannot be reached commercially at all, so callers
 * can say "not reachable" instead of rendering a fiction.
 */
export function itinerariesFor(
  origin: Origin,
  site: Place & { siteName: string },
): { fastest: Itinerary; cheapest: Itinerary } | null {
  const access = travelAccessOf(site);
  if (access.access === 'none' || !access.gateway) return null;

  const gateway = access.gateway;
  const airKm = distanceKm(origin, gateway);
  const gateLabel = `${gateway.code} · ${gateway.name}`;
  const onwardHours = round1(access.transferKm / onwardSpeed(access.transferMode));
  const onwardCost = onwardFare(access.transferKm, access.transferMode);

  const fastest: Itinerary = {
    kind: 'fastest',
    label: 'Fastest',
    legs: [
      {
        from: origin.label,
        to: gateLabel,
        mode: 'Direct flight',
        hours: round1(airKm / 840 + 1.1),
        costUsd: airFare(airKm),
      },
      {
        from: gateway.code,
        to: site.siteName,
        mode: access.transferMode,
        hours: onwardHours,
        costUsd: onwardCost,
      },
    ],
    hours: 0,
    costUsd: 0,
    flightsUrl: flightsUrl(gateway.code),
  };

  const cheapest: Itinerary = {
    kind: 'cheapest',
    label: 'Cheapest',
    legs: [
      {
        from: origin.label,
        to: gateLabel,
        mode: 'Flight, one stop',
        hours: round1((airKm / 840 + 1.1) * 1.16 + 2.5),
        costUsd: Math.round(airFare(airKm) * 0.68),
      },
      {
        from: gateway.code,
        to: site.siteName,
        mode: access.transferMode,
        hours: onwardHours,
        costUsd: onwardCost,
      },
    ],
    hours: 0,
    costUsd: 0,
    flightsUrl: flightsUrl(gateway.code),
  };

  for (const itinerary of [fastest, cheapest]) {
    itinerary.hours = round1(itinerary.legs.reduce((total, leg) => total + leg.hours, 0));
    itinerary.costUsd = itinerary.legs.reduce((total, leg) => total + leg.costUsd, 0);
  }

  return { fastest, cheapest };
}

/** What an export needs to carry, whether or not an origin has been set. */
export interface TravelExport {
  available: boolean;
  /** Why the itinerary is missing, when it is. */
  note: string;
  table: Table;
  html: string;
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

/**
 * Ascending itinerary table, one row per leg. Both itineraries go in the same
 * table so a reader can compare them line by line rather than across tabs.
 */
export function travelExport(
  site: Place & { siteName: string },
  origin: Origin | null,
): TravelExport {
  const access = travelAccessOf(site);
  const pair = origin ? itinerariesFor(origin, site) : null;

  if (!pair) {
    return {
      available: false,
      note: origin
        ? access.note
        : 'Set a location first — Mission constraints › Distance from me — so the itinerary has somewhere to start.',
      table: { header: ['itinerary', 'leg', 'from', 'to', 'mode', 'hours', 'est_cost_usd', 'note'], rows: [] },
      html: '',
    };
  }

  const header = ['itinerary', 'leg', 'from', 'to', 'mode', 'hours', 'est_cost_usd', 'note'];
  const rows: string[][] = [];
  for (const itinerary of [pair.fastest, pair.cheapest]) {
    itinerary.legs.forEach((leg, index) => {
      rows.push([
        `${itinerary.label} · ${itinerary.hours} h · ${money(itinerary.costUsd)}`,
        String(index + 1),
        leg.from,
        leg.to,
        leg.mode,
        leg.hours.toFixed(1),
        String(leg.costUsd),
        index === 0 ? 'Modelled air time and fare; check the live link before booking.' : 'Door-to-door from the gate airport.',
      ]);
    });
  }

  const cards = [pair.fastest, pair.cheapest]
    .map(
      (itinerary) => `      <article class="itin">
        <h3>${escapeXml(itinerary.label)} <span>${itinerary.hours} h · ${money(
          itinerary.costUsd,
        )}</span></h3>
        <ol>
${itinerary.legs
  .map(
    (leg) =>
      `          <li><b>${escapeXml(leg.from)} → ${escapeXml(leg.to)}</b> · ${escapeXml(
        leg.mode,
      )} · ${leg.hours} h · ${money(leg.costUsd)}</li>`,
  )
  .join('\n')}
        </ol>
      </article>`,
    )
    .join('\n');

  const html = `    <h2>Getting there from ${escapeXml(origin?.label ?? '')}</h2>
    <p class="hint">${escapeXml(access.note)} Gate: ${escapeXml(
      access.gateway ? `${access.gateway.code} ${access.gateway.name}` : '—',
    )}. Times and fares are modelled from distance, not quoted — check the live search before booking.</p>
    <div class="itins">
${cards}
    </div>`;

  return { available: true, note: access.note, table: { header, rows }, html };
}
