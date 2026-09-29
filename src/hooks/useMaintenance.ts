import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getMaintenancePhase,
  MAINTENANCE_BLOCKED_MESSAGE,
  maintenanceBannerMessage,
  type MaintenancePhase,
} from '../domain/maintenance';

export function useMaintenance() {
  const { session } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session?.maintenance) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [session?.maintenance]);

  const phase: MaintenancePhase = getMaintenancePhase(session?.maintenance);
  const blocked = phase === 'active';
  const showBanner = phase === 'upcoming' || phase === 'active';
  const bannerMessage = session?.maintenance && showBanner
    ? maintenanceBannerMessage(session.maintenance)
    : null;

  return {
    phase,
    blocked,
    showBanner,
    bannerMessage,
    blockedMessage: MAINTENANCE_BLOCKED_MESSAGE,
    assertWritable: () => {
      if (getMaintenancePhase(session?.maintenance) === 'active') {
        throw new Error(MAINTENANCE_BLOCKED_MESSAGE);
      }
    },
  };
}
