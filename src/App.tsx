import { useEffect, useMemo, useState } from 'react';
import { FeatureImportance } from './components/charts/FeatureImportance';
import { ScoreDistribution } from './components/charts/ScoreDistribution';
import { Panel } from './components/layout/Panel';
import { MapView } from './components/map/MapView';
import { DataSourceList } from './components/panels/DataSourceList';
import { AnalogScene } from './components/three/AnalogScene';
import { getDatasets, getPredictions, usingMockData } from './services/api';
import type { DataSource, Prediction } from './data-contracts/types';

export default function App() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [datasets, setDatasets] = useState<DataSource[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        <div className="stat">
          <span className="stat-value">{stats.count}</span>
          <span className="stat-label">Candidate sites</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.meanScore.toFixed(2)}</span>
          <span className="stat-label">Mean analog fit</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.strong}</span>
          <span className="stat-label">Strong analogs</span>
        </div>
        <div className="stat">
          <span className="stat-value">{datasets.length}</span>
          <span className="stat-label">NASA datasets</span>
        </div>
      </div>

      <main className="grid">
        <Panel
          title="Analog site map"
          subtitle="Candidate terrestrial analogs, scored by fit (click a site)"
          className="span-2"
        >
          <MapView predictions={predictions} />
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
  );
}
