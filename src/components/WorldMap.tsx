// Renders real country borders from geometry bundled with the app (no runtime
// fetch, so it works offline). Highlights the lit country during the lottery
// and the won country once it settles.

import { useEffect, useMemo, useRef } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';

const WIDTH = 440;
const HEIGHT = 210;

interface CountryFeature {
  id?: string | number;
  properties: { name: string };
}

// Convert the bundled TopoJSON into GeoJSON features once, at module load.
// d3-geo's path functions accept these features at runtime; the casts keep us
// from depending on the heavy topojson/geojson type packages just for shapes.
const topology = worldData as unknown as Parameters<typeof feature>[0];
const collection = feature(topology, (topology as { objects: Record<string, unknown> }).objects.countries as never);
const featureList = (collection as unknown as { features: CountryFeature[] }).features;

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], collection as never);
const path = geoPath(projection);

function shapeFor(country: CountryFeature): string {
  return path(country as never) ?? '';
}

function matches(countryName: string, target: string): boolean {
  // Exact (case-insensitive) match. Team `mapName` values are set to the
  // Natural Earth country names, so this avoids mis-highlighting lookalikes
  // such as Niger/Nigeria or India/British Indian Ocean Territory.
  return countryName.toLowerCase() === target.toLowerCase();
}

interface WorldMapProps {
  litCountry: string | null;
  wonCountry: string | null;
}

export function WorldMap({ litCountry, wonCountry }: WorldMapProps) {
  const ringRef = useRef<SVGCircleElement>(null);

  const shapes = useMemo(
    () =>
      featureList.map((country, index) => ({
        key: country.id ?? index,
        name: country.properties.name,
        d: shapeFor(country),
      })),
    [],
  );

  // Pulse a ring on the won country's centroid.
  useEffect(() => {
    if (!wonCountry || !ringRef.current) return;
    const match = featureList.find((c) => matches(c.properties.name, wonCountry));
    if (!match) return;
    const [cx, cy] = path.centroid(match as never);
    const ring = ringRef.current;
    ring.setAttribute('cx', String(cx));
    ring.setAttribute('cy', String(cy));
    ring.classList.remove('ring-go');
    void ring.getBoundingClientRect(); // restart the animation
    ring.classList.add('ring-go');
  }, [wonCountry]);

  return (
    <svg className="worldmap" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
      <g>
        {shapes.map((shape) => {
          const isWon = wonCountry !== null && matches(shape.name, wonCountry);
          const isLit = !isWon && litCountry !== null && matches(shape.name, litCountry);
          return (
            <path
              key={shape.key}
              d={shape.d}
              fill={isWon ? 'var(--gold)' : isLit ? 'var(--grass)' : '#191d1a'}
              stroke={isWon ? 'var(--gold)' : isLit ? 'var(--grass)' : 'rgba(255,255,255,0.07)'}
              strokeWidth={isWon ? 0.7 : 0.4}
              style={isWon ? { filter: 'drop-shadow(0 0 7px rgba(217,178,91,0.85))' } : undefined}
            />
          );
        })}
      </g>
      <circle ref={ringRef} r={6} fill="none" stroke="var(--gold)" strokeWidth={2} opacity={0} />
    </svg>
  );
}
