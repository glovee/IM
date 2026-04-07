import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockUser, mockUsersDirectory } from '../data/mockData.ts';
import { Board, BoardConnection, BoardIncidentNode, BoardMember, BoardPoint, BoardStroke } from '../types/board.ts';

const BOARDS_SYNC_CHANNEL = 'im-boards-realtime-sync-v1';
const NODE_WIDTH = 320;
const NODE_HEIGHT = 136;

interface BoardsSyncPayload {
  sourceId: string;
  sentAt: number;
  boards: Board[];
}

interface CreateBoardInput {
  title: string;
  description: string;
  team: string;
  memberIds: string[];
}

interface AddStrokeInput {
  color: string;
  width: number;
  points: BoardPoint[];
  authorId?: string;
}

interface BoardsState {
  boards: Board[];
  createBoard: (input: CreateBoardInput) => string;
  deleteBoard: (boardId: string) => void;
  updateBoardMeta: (boardId: string, updates: Partial<Pick<Board, 'title' | 'description' | 'team'>>) => void;
  addIncidentToBoard: (boardId: string, incidentId: string) => string | null;
  removeIncidentFromBoard: (boardId: string, nodeId: string) => void;
  moveIncidentNode: (boardId: string, nodeId: string, x: number, y: number) => void;
  connectIncidentNodes: (boardId: string, fromNodeId: string, toNodeId: string) => void;
  clearBoardConnections: (boardId: string) => void;
  addStroke: (boardId: string, input: AddStrokeInput) => void;
  clearBoardDrawing: (boardId: string) => void;
  syncBoardsFromRemote: (boards: Board[]) => void;
}

const syncClientId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `boards-client-${Math.random().toString(36).slice(2)}`;

let syncChannel: BroadcastChannel | null = null;
let realtimeListenersInitialized = false;

function getNowISO() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function resolveMembers(memberIds: string[]): BoardMember[] {
  const selectedMembers = mockUsersDirectory.filter((user) => memberIds.includes(user.id));
  const membersWithoutOwner = selectedMembers.filter((user) => user.id !== mockUser.id);
  return [
    {
      ...mockUser,
      role: 'owner',
    },
    ...membersWithoutOwner.map((user) => ({
      ...user,
      role: 'editor' as const,
    })),
  ];
}

function getSyncChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  if (!syncChannel) {
    syncChannel = new BroadcastChannel(BOARDS_SYNC_CHANNEL);
  }

  return syncChannel;
}

function publishBoardsToPeers(boards: Board[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: BoardsSyncPayload = {
    sourceId: syncClientId,
    sentAt: Date.now(),
    boards,
  };

  const channel = getSyncChannel();
  channel?.postMessage(payload);

  try {
    window.localStorage.setItem(BOARDS_SYNC_CHANNEL, JSON.stringify(payload));
  } catch (error) {
    console.warn('Не удалось сохранить realtime-событие досок', error);
  }
}

function withBoardUpdate(boards: Board[], boardId: string, updater: (board: Board) => Board): Board[] {
  return boards.map((board) => (board.id === boardId ? updater(board) : board));
}

const seedBoards: Board[] = [
  {
    id: 'board-seed-1',
    title: 'Kill Chain: lateral movement',
    description: 'Сценарий построения цепочки атаки и подтверждения артефактов.',
    team: 'SOC L1',
    ownerId: mockUser.id,
    createdAt: '2026-04-04T09:15:00.000Z',
    updatedAt: '2026-04-06T11:32:00.000Z',
    members: resolveMembers(['u2', 'u3']),
    strokes: [
      {
        id: 'stroke-seed-1',
        authorId: mockUser.id,
        color: '#2563eb',
        width: 3,
        createdAt: '2026-04-06T11:31:00.000Z',
        points: [
          { x: 120, y: 160 },
          { x: 180, y: 180 },
          { x: 260, y: 210 },
          { x: 320, y: 240 },
        ],
      },
    ],
    incidentNodes: [
      {
        id: 'node-seed-1',
        incidentId: '1',
        x: 84,
        y: 80,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
      {
        id: 'node-seed-2',
        incidentId: '7',
        x: 460,
        y: 220,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
    ],
    connections: [
      {
        id: 'conn-seed-1',
        fromNodeId: 'node-seed-1',
        toNodeId: 'node-seed-2',
      },
    ],
  },
  {
    id: 'board-seed-2',
    title: 'DLP расследование: утечка почтой',
    description: 'Сопоставление событий DLP и подтверждение вовлеченных узлов.',
    team: 'DLP',
    ownerId: 'u2',
    createdAt: '2026-04-03T08:00:00.000Z',
    updatedAt: '2026-04-06T18:20:00.000Z',
    members: [
      {
        ...mockUsersDirectory.find((user) => user.id === 'u2')!,
        role: 'owner',
      },
      {
        ...mockUser,
        role: 'editor',
      },
      {
        ...mockUsersDirectory.find((user) => user.id === 'u5')!,
        role: 'viewer',
      },
    ],
    strokes: [],
    incidentNodes: [
      {
        id: 'node-seed-3',
        incidentId: '3',
        x: 120,
        y: 100,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
    ],
    connections: [],
  },
];

export const useBoardsStore = create<BoardsState>()(
  persist(
    (set) => ({
      boards: seedBoards,
      createBoard: (input) => {
        const boardId = createId('board');
        const now = getNowISO();
        const nextBoard: Board = {
          id: boardId,
          title: input.title.trim(),
          description: input.description.trim(),
          team: input.team,
          ownerId: mockUser.id,
          createdAt: now,
          updatedAt: now,
          members: resolveMembers(input.memberIds),
          strokes: [],
          incidentNodes: [],
          connections: [],
        };

        set((state) => {
          const nextBoards = [nextBoard, ...state.boards];
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return boardId;
      },
      deleteBoard: (boardId) =>
        set((state) => {
          const nextBoards = state.boards.filter((board) => board.id !== boardId);
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      updateBoardMeta: (boardId, updates) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            ...updates,
            updatedAt: getNowISO(),
          }));
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      addIncidentToBoard: (boardId, incidentId) => {
        let createdNodeId: string | null = null;

        set((state) => {
          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const existingNode = targetBoard.incidentNodes.find((node) => node.incidentId === incidentId);
          if (existingNode) {
            createdNodeId = existingNode.id;
            return state;
          }

          const cardIndex = targetBoard.incidentNodes.length;
          const nextNode: BoardIncidentNode = {
            id: createId('board-node'),
            incidentId,
            x: 80 + (cardIndex % 3) * (NODE_WIDTH + 28),
            y: 80 + Math.floor(cardIndex / 3) * (NODE_HEIGHT + 28),
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          };
          createdNodeId = nextNode.id;

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            incidentNodes: [...board.incidentNodes, nextNode],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return createdNodeId;
      },
      removeIncidentFromBoard: (boardId, nodeId) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            incidentNodes: board.incidentNodes.filter((node) => node.id !== nodeId),
            connections: board.connections.filter(
              (connection) => connection.fromNodeId !== nodeId && connection.toNodeId !== nodeId
            ),
          }));
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      moveIncidentNode: (boardId, nodeId, x, y) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            incidentNodes: board.incidentNodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    x: Math.max(20, x),
                    y: Math.max(20, y),
                  }
                : node
            ),
          }));
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      connectIncidentNodes: (boardId, fromNodeId, toNodeId) =>
        set((state) => {
          if (fromNodeId === toNodeId) {
            return state;
          }

          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const isDuplicate = targetBoard.connections.some(
            (connection) =>
              connection.fromNodeId === fromNodeId &&
              connection.toNodeId === toNodeId
          );

          if (isDuplicate) {
            return state;
          }

          const nextConnection: BoardConnection = {
            id: createId('board-conn'),
            fromNodeId,
            toNodeId,
          };

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            connections: [...board.connections, nextConnection],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      clearBoardConnections: (boardId) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            connections: [],
          }));
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      addStroke: (boardId, input) =>
        set((state) => {
          if (input.points.length < 2) {
            return state;
          }

          const nextStroke: BoardStroke = {
            id: createId('board-stroke'),
            authorId: input.authorId ?? mockUser.id,
            color: input.color,
            width: input.width,
            points: input.points,
            createdAt: getNowISO(),
          };

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            strokes: [...board.strokes, nextStroke],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      clearBoardDrawing: (boardId) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            strokes: [],
          }));
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      syncBoardsFromRemote: (boards) => set({ boards }),
    }),
    {
      name: 'boards-storage',
    }
  )
);

function readSyncPayload(raw: string | null): BoardsSyncPayload | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as BoardsSyncPayload;
    if (!parsed || !Array.isArray(parsed.boards)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function initializeBoardsRealtimeSync() {
  if (realtimeListenersInitialized || typeof window === 'undefined') {
    return;
  }
  realtimeListenersInitialized = true;

  const applyRemotePayload = (payload: BoardsSyncPayload | null) => {
    if (!payload || payload.sourceId === syncClientId) {
      return;
    }
    useBoardsStore.getState().syncBoardsFromRemote(payload.boards);
  };

  const channel = getSyncChannel();
  channel?.addEventListener('message', (event: MessageEvent<BoardsSyncPayload>) => {
    applyRemotePayload(event.data);
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== BOARDS_SYNC_CHANNEL) {
      return;
    }
    applyRemotePayload(readSyncPayload(event.newValue));
  });

  const latestPayload = readSyncPayload(window.localStorage.getItem(BOARDS_SYNC_CHANNEL));
  applyRemotePayload(latestPayload);

  const currentBoards = useBoardsStore.getState().boards;
  publishBoardsToPeers(currentBoards);
}
