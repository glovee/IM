import { useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router';
import IncidentTable from './IncidentTable/IncidentTable.tsx';
import { useIncidentsStore, initWsSubscriptions } from '../../../store/incidents.ts';
import { useIncidentFieldsStore } from '../../../store/incidentFieldsStore.ts';
import { useTeamsStore } from '../../../store/teamsStore.ts';
import { useIncidentTypesStore } from '../../../store/incidentTypesStore.ts';

interface OutletContext {
  activeTeam: string;
}

export default function IncidentsPage() {
  const { activeTeam } = useOutletContext<OutletContext>();
  const incidents = useIncidentsStore((state) => state.incidents);
  const loading = useIncidentsStore((state) => state.loading);
  const error = useIncidentsStore((state) => state.error);
  const fetchIncidents = useIncidentsStore((state) => state.fetchIncidents);
  const loadAllDicts = useIncidentFieldsStore((state) => state.loadAllDicts);
  const fetchTeams = useTeamsStore((state) => state.fetchTeams);
  const fetchTypes = useIncidentTypesStore((state) => state.fetchTypes);

  // Инициализация WebSocket, справочников, команд и типов
  useEffect(() => {
    initWsSubscriptions();
    loadAllDicts();
    fetchTeams();
    fetchTypes();
  }, [loadAllDicts, fetchTeams, fetchTypes]);

  // Загрузка инцидентов при монтировании
  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => incident.команда === activeTeam);
  }, [activeTeam, incidents]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent" />
          <p className="mt-3 text-sm text-gray-500">Загрузка инцидентов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Ошибка загрузки</h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchIncidents()}
            className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Инциденты</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Команда: <span className="font-medium">{activeTeam}</span> • Всего инцидентов: {filteredIncidents.length}
        </p>
      </div>

      <IncidentTable incidents={filteredIncidents} />
    </div>
  );
}
