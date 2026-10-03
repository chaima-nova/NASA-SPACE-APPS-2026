import { useEffect, useMemo, useState } from 'react';
import { FeatureImportance } from './components/charts/FeatureImportance';
import { ScoreDistribution } from './components/charts/ScoreDistribution';
import { Panel } from './components/layout/Panel';
import { MapView } from './components/map/MapView';
import { DataSourceList } from './components/panels/DataSourceList';
import { UrbanHeatScene } from './components/three/UrbanHeatScene';
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
      return { count: 0, meanRisk: 0, highRisk: 0 };
    }
    const total = predictions.reduce((sum, p) => sum + p.heatRisk, 0);
    return {
      count: predictions.length,
      meanRisk: total / predictions.length,
      highRisk: predictions.filter((p) => p.heatRisk > 0.66).length,
    };
  }, [predictions]);

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>Urban Heat &amp; Environmental Health</h1>
          <p className="app-sub">
            Visualization shell · map · charts · 3D — built on sample data, ready
            for the real pipeline.
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
          <span className="stat-label">Sample points</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.meanRisk.toFixed(2)}</span>
          <span className="stat-label">Mean heat risk</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.highRisk}</span>
          <span className="stat-label">High-risk cells</span>
        </div>
        <div className="stat">
          <span className="stat-value">{datasets.length}</span>
          <span className="stat-label">NASA datasets</span>
        </div>
      </div>

      <main className="grid">
        <Panel
          title="Risk map"
          subtitle="Heat risk per sample point (click a point for detail)"
          className="span-2"
        >
          <MapView predictions={predictions} />
        </Panel>

        <Panel title="3D risk columns" subtitle="Height + colour encode risk">
          <UrbanHeatScene predictions={predictions} />
        </Panel>

        <Panel title="Risk distribution" subtitle="Points per risk bucket">
          <ScoreDistribution predictions={predictions} />
        </Panel>

        <Panel title="Feature influence" subtitle="Mean absolute contribution">
          <FeatureImportance predictions={predictions} />
        </Panel>

        <Panel
          title="Data sources"
          subtitle="NASA datasets behind these layers"
          className="span-2"
        >
          <DataSourceList datasets={datasets} />
        </Panel>
      </main>
    </div>
  );
}
