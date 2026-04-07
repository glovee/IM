import { useEffect } from 'react';
import { initializeBoardsRealtimeSync } from '../../../store/boardsStore.ts';

export function useBoardsRealtimeSync() {
  useEffect(() => {
    initializeBoardsRealtimeSync();
  }, []);
}
