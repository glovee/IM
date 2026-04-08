import { create } from 'zustand';
import { teamsApi } from '../api/client.ts';

export interface TeamMember {
  userId: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canAssign: boolean;
  };
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
}

interface TeamsState {
  teams: Team[];
  loading: boolean;
  fetchTeams: () => Promise<void>;
  addTeam: (team: Omit<Team, 'id'>) => Promise<void>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  removeTeam: (id: string) => Promise<void>;
  addMember: (teamId: string, member: TeamMember) => void;
  removeMember: (teamId: string, userId: string) => void;
  updatePermission: (teamId: string, userId: string, permission: string, value: boolean) => void;
  getTeamNames: () => string[];
}

export const useTeamsStore = create<TeamsState>()((set, get) => ({
  teams: [],
  loading: false,

  fetchTeams: async () => {
    set({ loading: true });
    try {
      const data = await teamsApi.list();
      set({
        teams: data.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          members: [],
        })),
        loading: false,
      });
    } catch (e) {
      console.error('[Teams] Fetch error:', e);
      set({ loading: false });
    }
  },

  addTeam: async (team) => {
    try {
      const result = await teamsApi.create(team);
      set((state) => ({
        teams: [...state.teams, { id: result.id, name: result.name, description: result.description || '', members: [] }],
      }));
    } catch (e) {
      console.error('[Teams] Create error:', e);
      await get().fetchTeams();
    }
  },

  updateTeam: async (id, updates) => {
    try {
      await teamsApi.update(id, updates);
      set((state) => ({
        teams: state.teams.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
    } catch (e) {
      console.error('[Teams] Update error:', e);
      await get().fetchTeams();
    }
  },

  removeTeam: async (id) => {
    try {
      await teamsApi.delete(id);
      set((state) => ({
        teams: state.teams.filter((t) => t.id !== id),
      }));
    } catch (e) {
      console.error('[Teams] Delete error:', e);
      await get().fetchTeams();
    }
  },

  addMember: (teamId, member) => {
    set((state) => ({
      teams: state.teams.map((t) => {
        if (t.id !== teamId) return t;
        if (t.members.some((m) => m.userId === member.userId)) return t;
        return { ...t, members: [...t.members, member] };
      }),
    }));
  },

  removeMember: (teamId, userId) => {
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, members: t.members.filter((m) => m.userId !== userId) } : t
      ),
    }));
  },

  updatePermission: (teamId, userId, permission, value) => {
    set((state) => ({
      teams: state.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          members: t.members.map((m) =>
            m.userId === userId ? { ...m, permissions: { ...m.permissions, [permission]: value } } : m
          ),
        };
      }),
    }));
  },

  getTeamNames: () => {
    return get().teams.map((t) => t.name);
  },
}));
