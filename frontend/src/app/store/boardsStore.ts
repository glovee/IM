import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockUser, mockUsersDirectory } from '../data/mockData.ts';
import {
  Board,
  BoardCanvasItem,
  BoardConnection,
  BoardEntityItem,
  BoardEntityKind,
  BoardIconItem,
  BoardIconKind,
  BoardImageItem,
  BoardMember,
  BoardMemberRole,
  BoardPoint,
  BoardStroke,
  BoardTextItem,
} from '../types/board.ts';

const BOARDS_SYNC_CHANNEL = 'im-boards-realtime-sync-v1';
const STORAGE_VERSION = 2;

const ITEM_SIZE = {
  incident: { width: 320, height: 136 },
  violator: { width: 320, height: 122 },
  entity: { width: 320, height: 146 },
  text: { width: 320, height: 120 },
  image: { width: 320, height: 220 },
  icon: { width: 168, height: 130 },
};

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

interface AddEntityInput {
  kind: BoardEntityKind;
  title: string;
  host?: string;
  description?: string;
}

interface AddTextInput {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
}

interface AddImageInput {
  src: string;
  fileName: string;
  mimeType: 'image/png' | 'image/jpeg';
}

interface AddIconInput {
  icon: BoardIconKind;
  label: string;
  color: string;
}

interface BoardsState {
  boards: Board[];
  createBoard: (input: CreateBoardInput) => string;
  deleteBoard: (boardId: string) => void;
  leaveBoard: (boardId: string, userId: string) => void;
  addBoardMember: (boardId: string, userId: string, role?: Exclude<BoardMemberRole, 'owner'>) => void;
  removeBoardMember: (boardId: string, userId: string) => void;
  updateBoardMeta: (boardId: string, updates: Partial<Pick<Board, 'title' | 'description' | 'team'>>) => void;
  addIncidentToBoard: (boardId: string, incidentId: string) => string | null;
  addViolatorToBoard: (boardId: string, violatorId: string) => string | null;
  addEntityToBoard: (boardId: string, input: AddEntityInput) => string | null;
  addTextToBoard: (boardId: string, input: AddTextInput) => string | null;
  addImageToBoard: (boardId: string, input: AddImageInput) => string | null;
  addIconToBoard: (boardId: string, input: AddIconInput) => string | null;
  removeBoardItem: (boardId: string, itemId: string) => void;
  moveBoardItem: (boardId: string, itemId: string, x: number, y: number) => void;
  connectBoardItems: (boardId: string, fromItemId: string, toItemId: string) => void;
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

function resolveMemberById(userId: string, role: BoardMemberRole): BoardMember | null {
  const sourceUser = mockUsersDirectory.find((user) => user.id === userId);
  if (!sourceUser) {
    return null;
  }
  return {
    ...sourceUser,
    role,
  };
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

function getNextItemPosition(items: BoardCanvasItem[]) {
  const index = items.length;
  return {
    x: 80 + (index % 3) * 348,
    y: 80 + Math.floor(index / 3) * 190,
  };
}

function toSafeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function isRole(value: string): value is BoardMemberRole {
  return value === 'owner' || value === 'editor' || value === 'viewer';
}

function isEntityKind(value: string): value is BoardEntityKind {
  return value === 'external_host' || value === 'infrastructure' || value === 'event' || value === 'service' || value === 'note';
}

function isIconKind(value: string): value is BoardIconKind {
  return (
    value === 'person' ||
    value === 'computer' ||
    value === 'server' ||
    value === 'database' ||
    value === 'network' ||
    value === 'threat' ||
    value === 'shield'
  );
}

function normalizeMember(raw: unknown): BoardMember | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = toSafeString(record.id);
  const name = toSafeString(record.name);
  const email = toSafeString(record.email);
  const avatar = toSafeString(record.avatar, `https://api.dicebear.com/7.x/avataaars/svg?seed=${id || name || 'user'}`);
  const roleRaw = toSafeString(record.role, 'editor');
  if (!id || !name || !email || !isRole(roleRaw)) {
    return null;
  }
  return { id, name, email, avatar, role: roleRaw };
}

function normalizeStroke(raw: unknown): BoardStroke | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const pointsRaw = Array.isArray(record.points) ? record.points : [];
  const points: BoardPoint[] = pointsRaw
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null;
      }
      const p = point as Record<string, unknown>;
      if (typeof p.x !== 'number' || typeof p.y !== 'number') {
        return null;
      }
      return { x: p.x, y: p.y };
    })
    .filter((point): point is BoardPoint => Boolean(point));

  if (points.length < 2) {
    return null;
  }

  return {
    id: toSafeString(record.id, createId('board-stroke')),
    authorId: toSafeString(record.authorId, mockUser.id),
    color: toSafeString(record.color, '#2563eb'),
    width: typeof record.width === 'number' ? record.width : 3,
    points,
    createdAt: toSafeString(record.createdAt, getNowISO()),
  };
}

function normalizeItem(raw: unknown): BoardCanvasItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const typeRaw = toSafeString(record.type);
  const x = typeof record.x === 'number' ? record.x : 80;
  const y = typeof record.y === 'number' ? record.y : 80;
  const width = typeof record.width === 'number' ? record.width : 320;
  const height = typeof record.height === 'number' ? record.height : 136;
  const id = toSafeString(record.id, createId('board-item'));

  if (typeRaw === 'incident' || (!typeRaw && typeof record.incidentId === 'string')) {
    const incidentId = toSafeString(record.incidentId);
    if (!incidentId) {
      return null;
    }
    return { id, type: 'incident', incidentId, x, y, width, height };
  }

  if (typeRaw === 'violator' && typeof record.violatorId === 'string') {
    return {
      id,
      type: 'violator',
      violatorId: toSafeString(record.violatorId),
      x,
      y,
      width,
      height,
    };
  }

  if (typeRaw === 'entity') {
    const kindRaw = toSafeString(record.kind, 'note');
    return {
      id,
      type: 'entity',
      kind: isEntityKind(kindRaw) ? kindRaw : 'note',
      title: toSafeString(record.title, 'Новая сущность'),
      host: toSafeString(record.host, ''),
      description: toSafeString(record.description, ''),
      x,
      y,
      width,
      height,
    };
  }

  if (typeRaw === 'text') {
    return {
      id,
      type: 'text',
      text: toSafeString(record.text, 'Новый текст'),
      fontFamily: toSafeString(record.fontFamily, 'Inter, sans-serif'),
      fontSize: typeof record.fontSize === 'number' ? record.fontSize : 18,
      fontWeight:
        record.fontWeight === 400 ||
        record.fontWeight === 500 ||
        record.fontWeight === 600 ||
        record.fontWeight === 700
          ? record.fontWeight
          : 500,
      color: toSafeString(record.color, '#111827'),
      x,
      y,
      width,
      height,
    };
  }

  if (typeRaw === 'image') {
    const mimeRaw = toSafeString(record.mimeType, 'image/png');
    return {
      id,
      type: 'image',
      src: toSafeString(record.src),
      fileName: toSafeString(record.fileName, 'image.png'),
      mimeType: mimeRaw === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      x,
      y,
      width,
      height,
    };
  }

  if (typeRaw === 'icon') {
    const iconRaw = toSafeString(record.icon, 'computer');
    return {
      id,
      type: 'icon',
      icon: isIconKind(iconRaw) ? iconRaw : 'computer',
      label: toSafeString(record.label, 'Новый объект'),
      color: toSafeString(record.color, '#2563eb'),
      x,
      y,
      width,
      height,
    };
  }

  return null;
}

function normalizeBoard(raw: unknown): Board | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const membersRaw = Array.isArray(record.members) ? record.members : [];
  const normalizedMembers = membersRaw
    .map((member) => normalizeMember(member))
    .filter((member): member is BoardMember => Boolean(member));

  const ownerId = toSafeString(record.ownerId, mockUser.id);
  const ensuredOwner =
    normalizedMembers.find((member) => member.id === ownerId && member.role === 'owner') ??
    resolveMemberById(ownerId, 'owner') ??
    { ...mockUser, role: 'owner' as const };

  const membersWithoutOwner = normalizedMembers.filter((member) => member.id !== ensuredOwner.id);

  const itemsSource = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.incidentNodes)
      ? record.incidentNodes
      : [];

  const items = itemsSource
    .map((item) => normalizeItem(item))
    .filter((item): item is BoardCanvasItem => Boolean(item));

  const validItemIds = new Set(items.map((item) => item.id));
  const connectionsRaw = Array.isArray(record.connections) ? record.connections : [];
  const connections: BoardConnection[] = connectionsRaw
    .map((connection) => {
      if (!connection || typeof connection !== 'object') {
        return null;
      }
      const conn = connection as Record<string, unknown>;
      const fromItemId = toSafeString(conn.fromItemId || conn.fromNodeId);
      const toItemId = toSafeString(conn.toItemId || conn.toNodeId);
      if (!fromItemId || !toItemId || !validItemIds.has(fromItemId) || !validItemIds.has(toItemId)) {
        return null;
      }
      return {
        id: toSafeString(conn.id, createId('board-conn')),
        fromItemId,
        toItemId,
      };
    })
    .filter((connection): connection is BoardConnection => Boolean(connection));

  const strokesRaw = Array.isArray(record.strokes) ? record.strokes : [];
  const strokes = strokesRaw
    .map((stroke) => normalizeStroke(stroke))
    .filter((stroke): stroke is BoardStroke => Boolean(stroke));

  return {
    id: toSafeString(record.id, createId('board')),
    title: toSafeString(record.title, 'Новая доска'),
    description: toSafeString(record.description),
    team: toSafeString(record.team, 'SOC L1'),
    ownerId: ensuredOwner.id,
    createdAt: toSafeString(record.createdAt, getNowISO()),
    updatedAt: toSafeString(record.updatedAt, getNowISO()),
    members: [ensuredOwner, ...membersWithoutOwner],
    strokes,
    items,
    connections,
  };
}

function normalizeBoards(boards: unknown): Board[] {
  if (!Array.isArray(boards)) {
    return [];
  }
  return boards
    .map((board) => normalizeBoard(board))
    .filter((board): board is Board => Boolean(board));
}

function normalizePersistedState(persistedState: unknown) {
  if (!persistedState || typeof persistedState !== 'object') {
    return { boards: seedBoards };
  }
  const record = persistedState as Record<string, unknown>;
  const normalized = normalizeBoards(record.boards);
  return { boards: normalized.length > 0 ? normalized : seedBoards };
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
    items: [
      {
        id: 'item-seed-1',
        type: 'incident',
        incidentId: '1',
        x: 84,
        y: 80,
        width: ITEM_SIZE.incident.width,
        height: ITEM_SIZE.incident.height,
      },
      {
        id: 'item-seed-2',
        type: 'incident',
        incidentId: '7',
        x: 460,
        y: 220,
        width: ITEM_SIZE.incident.width,
        height: ITEM_SIZE.incident.height,
      },
      {
        id: 'item-seed-3',
        type: 'icon',
        icon: 'server',
        label: 'Контроллер домена',
        color: '#475569',
        x: 860,
        y: 150,
        width: ITEM_SIZE.icon.width,
        height: ITEM_SIZE.icon.height,
      },
    ],
    connections: [
      {
        id: 'conn-seed-1',
        fromItemId: 'item-seed-1',
        toItemId: 'item-seed-2',
      },
      {
        id: 'conn-seed-2',
        fromItemId: 'item-seed-2',
        toItemId: 'item-seed-3',
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
    items: [
      {
        id: 'item-seed-4',
        type: 'incident',
        incidentId: '3',
        x: 120,
        y: 100,
        width: ITEM_SIZE.incident.width,
        height: ITEM_SIZE.incident.height,
      },
      {
        id: 'item-seed-5',
        type: 'entity',
        kind: 'external_host',
        title: 'Внешний SMTP relay',
        host: '185.21.66.90',
        description: 'Источник массовой отправки на личные почты',
        x: 510,
        y: 220,
        width: ITEM_SIZE.entity.width,
        height: ITEM_SIZE.entity.height,
      },
    ],
    connections: [
      {
        id: 'conn-seed-3',
        fromItemId: 'item-seed-4',
        toItemId: 'item-seed-5',
      },
    ],
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
          items: [],
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
      leaveBoard: (boardId, userId) =>
        set((state) => {
          const nextBoards = state.boards.flatMap((board) => {
            if (board.id !== boardId) {
              return [board];
            }
            if (board.ownerId === userId) {
              return [board];
            }
            const nextMembers = board.members.filter((member) => member.id !== userId);
            return [
              {
                ...board,
                members: nextMembers,
                updatedAt: getNowISO(),
              },
            ];
          });
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      addBoardMember: (boardId, userId, role = 'editor') =>
        set((state) => {
          const memberToAdd = resolveMemberById(userId, role);
          if (!memberToAdd) {
            return state;
          }

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => {
            if (board.members.some((member) => member.id === userId)) {
              return board;
            }
            return {
              ...board,
              updatedAt: getNowISO(),
              members: [...board.members, memberToAdd],
            };
          });

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      removeBoardMember: (boardId, userId) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => {
            if (board.ownerId === userId) {
              return board;
            }
            return {
              ...board,
              updatedAt: getNowISO(),
              members: board.members.filter((member) => member.id !== userId),
            };
          });

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
        let createdItemId: string | null = null;

        set((state) => {
          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const existingItem = targetBoard.items.find(
            (item) => item.type === 'incident' && item.incidentId === incidentId
          );
          if (existingItem) {
            createdItemId = existingItem.id;
            return state;
          }

          const position = getNextItemPosition(targetBoard.items);
          const nextItem: BoardCanvasItem = {
            id: createId('board-item'),
            type: 'incident',
            incidentId,
            x: position.x,
            y: position.y,
            width: ITEM_SIZE.incident.width,
            height: ITEM_SIZE.incident.height,
          };
          createdItemId = nextItem.id;

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: [...board.items, nextItem],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return createdItemId;
      },
      addViolatorToBoard: (boardId, violatorId) => {
        let createdItemId: string | null = null;

        set((state) => {
          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const existingItem = targetBoard.items.find(
            (item) => item.type === 'violator' && item.violatorId === violatorId
          );
          if (existingItem) {
            createdItemId = existingItem.id;
            return state;
          }

          const position = getNextItemPosition(targetBoard.items);
          const nextItem: BoardCanvasItem = {
            id: createId('board-item'),
            type: 'violator',
            violatorId,
            x: position.x,
            y: position.y,
            width: ITEM_SIZE.violator.width,
            height: ITEM_SIZE.violator.height,
          };
          createdItemId = nextItem.id;

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: [...board.items, nextItem],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return createdItemId;
      },
      addEntityToBoard: (boardId, input) => {
        let createdItemId: string | null = null;

        set((state) => {
          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const position = getNextItemPosition(targetBoard.items);
          const nextItem: BoardEntityItem = {
            id: createId('board-item'),
            type: 'entity',
            kind: input.kind,
            title: input.title.trim(),
            host: input.host?.trim(),
            description: input.description?.trim(),
            x: position.x,
            y: position.y,
            width: ITEM_SIZE.entity.width,
            height: ITEM_SIZE.entity.height,
          };
          createdItemId = nextItem.id;

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: [...board.items, nextItem],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return createdItemId;
      },
      addTextToBoard: (boardId, input) => {
        let createdItemId: string | null = null;

        set((state) => {
          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const position = getNextItemPosition(targetBoard.items);
          const nextItem: BoardTextItem = {
            id: createId('board-item'),
            type: 'text',
            text: input.text.trim(),
            fontFamily: input.fontFamily,
            fontSize: input.fontSize,
            fontWeight: input.fontWeight,
            color: input.color,
            x: position.x,
            y: position.y,
            width: ITEM_SIZE.text.width,
            height: ITEM_SIZE.text.height,
          };
          createdItemId = nextItem.id;

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: [...board.items, nextItem],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return createdItemId;
      },
      addImageToBoard: (boardId, input) => {
        let createdItemId: string | null = null;

        set((state) => {
          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const position = getNextItemPosition(targetBoard.items);
          const nextItem: BoardImageItem = {
            id: createId('board-item'),
            type: 'image',
            src: input.src,
            fileName: input.fileName,
            mimeType: input.mimeType,
            x: position.x,
            y: position.y,
            width: ITEM_SIZE.image.width,
            height: ITEM_SIZE.image.height,
          };
          createdItemId = nextItem.id;

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: [...board.items, nextItem],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return createdItemId;
      },
      addIconToBoard: (boardId, input) => {
        let createdItemId: string | null = null;

        set((state) => {
          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const position = getNextItemPosition(targetBoard.items);
          const nextItem: BoardIconItem = {
            id: createId('board-item'),
            type: 'icon',
            icon: input.icon,
            label: input.label.trim(),
            color: input.color,
            x: position.x,
            y: position.y,
            width: ITEM_SIZE.icon.width,
            height: ITEM_SIZE.icon.height,
          };
          createdItemId = nextItem.id;

          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: [...board.items, nextItem],
          }));

          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        });

        return createdItemId;
      },
      removeBoardItem: (boardId, itemId) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: board.items.filter((item) => item.id !== itemId),
            connections: board.connections.filter(
              (connection) => connection.fromItemId !== itemId && connection.toItemId !== itemId
            ),
          }));
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      moveBoardItem: (boardId, itemId, x, y) =>
        set((state) => {
          const nextBoards = withBoardUpdate(state.boards, boardId, (board) => ({
            ...board,
            updatedAt: getNowISO(),
            items: board.items.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    x: Math.max(20, x),
                    y: Math.max(20, y),
                  }
                : item
            ),
          }));
          publishBoardsToPeers(nextBoards);
          return { boards: nextBoards };
        }),
      connectBoardItems: (boardId, fromItemId, toItemId) =>
        set((state) => {
          if (fromItemId === toItemId) {
            return state;
          }

          const targetBoard = state.boards.find((board) => board.id === boardId);
          if (!targetBoard) {
            return state;
          }

          const hasFrom = targetBoard.items.some((item) => item.id === fromItemId);
          const hasTo = targetBoard.items.some((item) => item.id === toItemId);
          if (!hasFrom || !hasTo) {
            return state;
          }

          const isDuplicate = targetBoard.connections.some(
            (connection) => connection.fromItemId === fromItemId && connection.toItemId === toItemId
          );

          if (isDuplicate) {
            return state;
          }

          const nextConnection: BoardConnection = {
            id: createId('board-conn'),
            fromItemId,
            toItemId,
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
      syncBoardsFromRemote: (boards) => set({ boards: normalizeBoards(boards) }),
    }),
    {
      name: 'boards-storage',
      version: STORAGE_VERSION,
      migrate: (persistedState) => normalizePersistedState(persistedState),
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
    return {
      ...parsed,
      boards: normalizeBoards(parsed.boards),
    };
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
    applyRemotePayload({
      ...event.data,
      boards: normalizeBoards(event.data?.boards),
    });
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
