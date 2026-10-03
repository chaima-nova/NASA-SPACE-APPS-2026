import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import type { Prediction } from '../../data-contracts/types';

interface MapViewProps {
  predictions: Prediction[];
}

const SOURCE_ID = 'analog-fit';

/**
 * MapLibre map that renders one point per candidate analog site, coloured and
 * sized by analog-fit score. Data-driven paint expressions mean we only swap the
 * GeoJSON payload when new predictions arrive instead of rebuilding layers.
 */
export function MapView({ predictions }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      // Public demo style — no API key required, safe for a hackathon shell.
      style: 'https://demotiles.maplibre.org/style.json',
      center: [0, 20],
      zoom: 1.4,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: predictions.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id,
          siteName: p.siteName,
          label: p.label,
          focusArea: p.focusArea,
          analogScore: p.analogScore,
          marsFit: p.marsFit ?? 0,
        },
      })),
    };

    const apply = () => {
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
        return;
      }

      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: `${SOURCE_ID}-circles`,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'analogScore'],
            0,
            '#3182bd',
            0.5,
            '#fee08b',
            1,
            '#bd0026',
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'analogScore'],
            0,
            5,
            1,
            16,
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#0b1020',
          'circle-opacity': 0.85,
        },
      });

      map.on('click', `${SOURCE_ID}-circles`, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties as {
          siteName: string;
          label: string;
          focusArea: string;
          analogScore: number;
        };
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(
            `<strong>${props.siteName}</strong><br/>Analog fit: ${props.label} (${props.analogScore.toFixed(
              2,
            )})<br/><span style="opacity:.7;font-size:11px">${props.focusArea}</span>`,
          )
          .addTo(map);
      });
      map.on('mouseenter', `${SOURCE_ID}-circles`, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', `${SOURCE_ID}-circles`, () => {
        map.getCanvas().style.cursor = '';
      });
    };

    if (map.loaded()) apply();
    else map.once('load', apply);
  }, [predictions]);

  return <div ref={containerRef} className="map" />;
}
