import { create } from 'zustand';
import { IncidentTypeId } from '../types/incident.ts';
import { incidentTypesApi } from '../api/client.ts';

export interface IncidentTypeDefinition {
  id: IncidentTypeId | string;
  label: string;
  description: string;
  fieldIds: string[];
}

interface IncidentTypesState {
  types: IncidentTypeDefinition[];
  loading: boolean;
  fetchTypes: () => Promise<void>;
  setTypes: (types: IncidentTypeDefinition[]) => void;
  addType: (type: IncidentTypeDefinition) => Promise<void>;
  removeType: (typeId: string) => Promise<void>;
  updateType: (typeId: string, updates: Partial<IncidentTypeDefinition>) => Promise<void>;
  getTypeById: (typeId: string) => IncidentTypeDefinition | null;
  getTypes: () => IncidentTypeDefinition[];
  getTypeFieldIds: (typeId: string) => string[];
}

export const useIncidentTypesStore = create<IncidentTypesState>()((set, get) => ({
  types: [],
  loading: false,

  fetchTypes: async () => {
    set({ loading: true });
    try {
      const data = await incidentTypesApi.list();
      set({
        types: data.map((t: any) => ({
          id: t.code,
          label: t.name,
          description: t.description || '',
          fieldIds: [],
        })),
        loading: false,
      });
    } catch (e) {
      console.error('[IncidentTypes] Fetch error:', e);
      set({ loading: false });
    }
  },

  setTypes: (types) => set({ types }),

  addType: async (type) => {
    try {
      await incidentTypesApi.create({
        code: type.id,
        name: type.label,
        description: type.description,
      });
      set((state) => ({ types: [...state.types, type] }));
    } catch (e) {
      console.error('[IncidentTypes] Create error:', e);
      await get().fetchTypes();
    }
  },

  removeType: async (typeId) => {
    try {
      await incidentTypesApi.delete(typeId);
      set((state) => ({ types: state.types.filter((t) => t.id !== typeId) }));
    } catch (e) {
      console.error('[IncidentTypes] Delete error:', e);
      await get().fetchTypes();
    }
  },

  updateType: async (typeId, updates) => {
    try {
      await incidentTypesApi.update(typeId, {
        name: updates.label,
        description: updates.description,
      });
      set((state) => ({
        types: state.types.map((t) => (t.id === typeId ? { ...t, ...updates } : t)),
      }));
    } catch (e) {
      console.error('[IncidentTypes] Update error:', e);
      await get().fetchTypes();
    }
  },

  getTypeById: (typeId) => {
    const { types } = get();
    return types.find((t) => t.id === typeId) ?? null;
  },

  getTypes: () => {
    const { types } = get();
    return types;
  },

  getTypeFieldIds: (typeId) => {
    const type = get().getTypeById(typeId);
    return type?.fieldIds ?? [];
  },
}));
