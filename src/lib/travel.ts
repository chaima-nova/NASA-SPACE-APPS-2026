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
  scheduled: 'Commercial Travel Available',
  charter: 'Charter needed',
  none: 'No commercial access',
};

/** Google Flights for one airport code, when no origin is known yet. */
export function flightsUrl(code: string): string {
  return `https://www.google.com/travel/flights?q=Flights to ${code}`;
}

/** Bus and rail from the reader to the gate airport, as a Maps transit query. */
export function transitUrl(origin: Origin, gateway: Gateway): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${gateway.lat},${gateway.lon}&travelmode=transit`;
}

/** Driving directions ending at the site itself, not at the airport. */
export function siteDirectionsUrl(origin: Origin, site: Place): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${site.lat},${site.lon}&travelmode=driving`;
}
/**
 * Live searches for one route.
 *
 * Every field is a real search on a real site, carrying the real airport code
 * or the site coordinates: nothing here is a fare or a duration the app made
 * up. That is deliberate — an invented price is worse than no price, because a
 * reader plans around it.
 */
export interface RouteLinks {
  /** Google Flights search from the reader to the gate airport. */
  flights: string | null;
  /** The gate airport code, when the site has a gate on file. */
  gatewayCode: string | null;
  /** Bus and rail to the gate airport. */
  transit: string | null;
  /** Driving directions that end at the site coordinates. */
  directions: string;
}

/** Google Flights, asked about the route rather than about an airport. */
export function flightsToUrl(origin: Origin, code: string): string {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${origin.label} to ${code}`)}`;
}

export function routeLinks(origin: Origin, site: Place): RouteLinks {
  const access = travelAccessOf(site);
  const code = access.gateway?.code ?? null;
  return {
    flights: code ? flightsToUrl(origin, code) : null,
    gatewayCode: code,
    transit: access.gateway ? transitUrl(origin, access.gateway) : null,
    directions: siteDirectionsUrl(origin, site),
  };
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

/**
 * The journey as an exportable list. One row per leg, each carrying the live
 * search that sells it — no hours and no fares, because the app does not know
 * them. A reader who exports this gets links to check, not numbers to trust.
 */
export function travelExport(
  site: Place & { siteName: string },
  origin: Origin | null,
): TravelExport {
  const access = travelAccessOf(site);
  const start = origin;
  const links = start ? routeLinks(start, site) : null;

  if (!links || !start) {
    return {
      available: false,
      note: 'Set a location first — Mission constraints › Distance From Me — so the route has somewhere to start.',
      table: { header: ['leg', 'from', 'to', 'mode', 'live_search'], rows: [] },
      html: '',
    };
  }

  const header = ['leg', 'from', 'to', 'mode', 'live_search'];
  const rows: string[][] = [];
  if (links.flights) {
    rows.push([
      String(rows.length + 1),
      start.label,
      `${links.gatewayCode} · ${access.gateway?.name ?? ''}`,
      'Flight',
      links.flights,
    ]);
  }
  rows.push([
    String(rows.length + 1),
    links.gatewayCode ?? 'the gate',
    site.siteName,
    access.transferMode,
    links.directions,
  ]);

  const items = rows
    .map((row) => `          <li><b>${escapeXml(row[2])}</b> · ${escapeXml(row[3])} · <a href="${escapeXml(row[4])}">live search</a></li>`)
    .join(String.fromCharCode(10));

  const html = `    <h2>Getting there from ${escapeXml(start.label)}</h2>
    <p class="hint">${escapeXml(access.note)} The costs in the app are modelled ranges: the searches are live, so the price and the schedule are whatever the site shows today.</p>
    <ol>
${items}
    </ol>`;

  return { available: true, note: access.note, table: { header, rows }, html };
}

/* ---- Trip estimates ------------------------------------------------------
 *
 * The brief asks what a field party's options look like, and a party plans
 * around a total. There is still no flight API in the bundle, so the figures
 * below are modelled from distances the app really holds — the great-circle
 * route to the gate airport and the measured last leg — and every place they
 * appear says so.
 *
 * The rates are round and deliberately cautious. A number that looks precise
 * invites trust it has not earned, so the UI shows a range, names it an
 * estimate, and keeps the live search beside it as the only quote.
 */

/** Air leg: cruise speed, the hours an airport adds, and a fare curve. */
const AIR = { speedKmh: 760, overheadHours: 2.2, baseFare: 55, farePerKm: 0.105 };

/** Road: average speed including stops, and the cost of a hired vehicle and
 *  its fuel for a party of four, per kilometre. */
const ROAD = { speedKmh: 72, costPerKm: 0.14, detour: 1.27 };

/**
 * The rougher ways on from the gate, priced per kilometre because they are
 * chartered rather than bought seat by seat. A road transfer is the fallback:
 * an unmapped mode must not silently cost nothing.
 */
function onwardRates(mode: string): { speedKmh: number; costPerKm: number } {
  if (mode === 'Off-road transfer') return { speedKmh: 32, costPerKm: 0.85 };
  if (mode === 'Charter flight') return { speedKmh: 210, costPerKm: 4.2 };
  if (mode === 'Ice flight or ship') return { speedKmh: 190, costPerKm: 5.6 };
  return { speedKmh: ROAD.speedKmh, costPerKm: ROAD.costPerKm };
}

export interface TripOption {
  id: 'faster' | 'cheaper';
  /** What the reader is choosing: the card lead. */
  headline: string;
  /** The legs it is made of. */
  mode: string;
  km: number;
  hours: number;
  costLow: number;
  costHigh: number;
}

export interface TripEstimate {
  /** Great-circle route from the reader to the gate airport, in kilometres. */
  airKm: number;
  options: TripOption[];
  /** True when an overland-only trip is plausible from where the reader is. */
  groundPossible: boolean;
}

/** Fares are quoted to the nearest ten: a modelled number should not pretend
 *  to the dollar. */
const roundTen = (value: number) => Math.round(value / 10) * 10;

/** A modelled figure, as the range it deserves. */
const band = (value: number) => {
  const low = roundTen(value * 0.78);
  const high = roundTen(value * 1.32);
  return { low, high };
};

/** Past this, a vehicle stops being the cheaper way to arrive. */
const GROUND_LIMIT_KM = 1500;

/**
 * The two ways a party can make this trip, with a total cost for each.
 *
 * "Faster" is the itinerary the rest of the planner builds: fly to the gate,
 * then the measured last leg. "Cheaper" exists only when the site is reachable
 * overland from the reader at all, and it is one long road with the vehicle
 * and fuel carried by the party. Neither is offered when the app cannot build
 * it, rather than being padded with a guess.
 */
export function tripEstimate(origin: Origin, site: Place): TripEstimate {
  const access = travelAccessOf(site);
  const options: TripOption[] = [];
  let airKm = 0;

  if (access.gateway) {
    airKm = distanceKm(origin, access.gateway);
    const airHours = airKm / AIR.speedKmh + AIR.overheadHours;
    const airCost = AIR.baseFare + airKm * AIR.farePerKm;

    const rates = onwardRates(access.transferMode);
    const legHours = access.transferKm / rates.speedKmh;
    const legCost = access.transferKm * rates.costPerKm;

    // Half an hour of handover covers the change at the gate: bags, the hire
    // desk, the charter briefing.
    const hours = airHours + legHours + 0.5;
    const { low, high } = band(airCost + legCost);

    options.push({
      id: 'faster',
      headline: 'Faster',
      mode: `Fly to ${access.gateway.code}, then ${access.transferMode.toLowerCase()}`,
      km: airKm + access.transferKm,
      hours,
      costLow: low,
      costHigh: high,
    });
  }

  const overland = distanceKm(origin, site) * ROAD.detour;
  const groundPossible = overland <= GROUND_LIMIT_KM;
  if (groundPossible) {
    const { low, high } = band(overland * ROAD.costPerKm);
    options.push({
      id: 'cheaper',
      headline: 'Cheaper',
      mode: 'Road, with the vehicle and its fuel carried by the party',
      km: overland,
      hours: overland / ROAD.speedKmh,
      costLow: low,
      costHigh: high,
    });
  }

  return { airKm, options, groundPossible };
}

/** Hours as a reader reads them: "14 h 20 m". */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60);
  const whole = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${whole} h ${minutes} m` : `${whole} h`;
}

/** Dollars, without pretending to cents. */
export function formatMoney(value: number): string {
  return `$${roundTen(value).toLocaleString('en-US')}`;
}
