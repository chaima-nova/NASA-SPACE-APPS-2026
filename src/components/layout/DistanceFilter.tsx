import { Modal } from './Modal';
import { OriginPrompt } from './OriginPrompt';
import type { Origin } from '../../lib/geo';

interface DistanceFilterProps {
  origin: Origin | null;
  onPick: (origin: Origin) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * The origin picker for "Distance from me".
 *
 * The two routes live in `OriginPrompt`, which the commercial-travel check
 * shares: wherever a reader sets their origin first, the other facet reuses it
 * instead of asking again.
 */
export function DistanceFilter({ origin, onPick, onClear, onClose }: DistanceFilterProps) {
  return (
    <Modal
      kicker="Distance"
      title="Where are you measuring from?"
      subtitle="Analog sites are filtered by how far they are from here. Your location stays in this browser."
      onClose={onClose}
      className="distance-modal"
    >
      <OriginPrompt origin={origin} onPick={onPick} onClear={onClear} onDone={onClose} />
    </Modal>
  );
}
