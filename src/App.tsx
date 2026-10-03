import { useEffect, useMemo, useState } from 'react';
import { FeatureImportance } from './components/charts/FeatureImportance';
import { ScoreDistribution } from './components/charts/ScoreDistribution';
import { Panel } from './components/layout/Panel';
import { DataSourceList } from './components/panels/DataSourceList';
import { AnalogScene } from './components/three/AnalogScene';
import { MoonMap } from './components/three/MoonMap';
import { getDatasets, getPredictions, usingMockData } from './services/api';
import type { DataSource, Prediction } from './data-contracts/types';
import { useCountUp } from './lib/useScrollReveal';

function Stat({
  value,
  label,
  decimals = 0,
  active,
}: {
  value: number;
  label: string;
  decimals?: number;
  active: boolean;
}) {
  const animated = useCountUp(value, active);
  return (
    <div className="stat">
      <span className="stat-value">{animated.toFixed(decimals)}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function App() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [datasets, setDatasets] = useState<DataSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [nextPredictions, nextDatasets] = await Promise.all([
          getPredictions(),
          getDatasets(),
        ]);
        if (!alive) return;
        setPredictions(nextPredictions);
        setDatasets(nextDatasets);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  // Thin reading-progress bar across the top of the viewport.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrolled(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const stats = useMemo(() => {
    if (predictions.length === 0) {
      return { count: 0, meanScore: 0, strong: 0 };
    }
    const total = predictions.reduce((sum, p) => sum + p.analogScore, 0);
    return {
      count: predictions.length,
      meanScore: total / predictions.length,
      strong: predictions.filter((p) => p.analogScore > 0.66).length,
    };
  }, [predictions]);

  return (
    <div className="reveal-enabled">
      <div className="scroll-progress" style={{ transform: `scaleX(${scrolled})` }} />

      <div className="app">
        <header className="app-head">
          <div>
            <h1>Earth Analogs for Moon &amp; Mars Base Sites</h1>
            <p className="app-sub">
              Visualizing candidate terrestrial analog locations and their fit to
              permanent Moon base and Mars environments · map · charts · 3D.
            </p>
          </div>
          <span className={usingMockData ? 'badge badge-mock' : 'badge badge-live'}>
            {usingMockData ? 'Mock data' : 'Live API'}
          </span>
        </header>

        {error ? <p className="error">⚠ {error}</p> : null}

        <div className="stats">
          <Stat value={stats.count} label="Candidate sites" active={stats.count > 0} />
          <Stat
            value={stats.meanScore}
            label="Mean analog fit"
            decimals={2}
            active={stats.count > 0}
          />
          <Stat value={stats.strong} label="Strong analogs" active={stats.count > 0} />
          <Stat value={datasets.length} label="NASA datasets" active={datasets.length > 0} />
        </div>

        <main className="grid">
          <Panel
            title="Analog site map"
            subtitle="Interactive Moon globe — drag to orbit, hover a site for its analog fit"
            className="span-2"
          >
            <MoonMap predictions={predictions} />
          </Panel>

          <Panel title="Analog fit columns" subtitle="Height + colour encode fit">
            <AnalogScene predictions={predictions} />
          </Panel>

          <Panel title="Fit distribution" subtitle="Sites per analog-fit bucket">
            <ScoreDistribution predictions={predictions} />
          </Panel>

          <Panel title="Feature influence" subtitle="Mean absolute contribution">
            <FeatureImportance predictions={predictions} />
          </Panel>

          <Panel
            title="Data sources"
            subtitle="NASA Earth, Moon & Mars datasets behind these layers"
            className="span-2"
          >
            <DataSourceList datasets={datasets} />
          </Panel>
        </main>
      </div>
    </div>
  );
}
