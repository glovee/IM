import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Computer,
  Database,
  Eraser,
  Globe,
  ImagePlus,
  Link2,
  LogOut,
  MousePointer2,
  Paintbrush,
  Plus,
  Search,
  Server,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react';
import { mockUser, mockUsersDirectory } from '../../../data/mockData.ts';
import { useIncidentsStore } from '../../../store/incidents.ts';
import { useBoardsStore } from '../../../store/boardsStore.ts';
import { useViolatorsStore } from '../../../store/violatorsStore.ts';
import { BoardCanvasItem, BoardEntityKind, BoardIconKind, BoardPoint, BoardToolMode } from '../../../types/board.ts';
import { useBoardsRealtimeSync } from '../hooks/useBoardsRealtimeSync.ts';

interface DragItemState {
  itemId: string;
  offsetX: number;
  offsetY: number;
}

interface IconCatalogEntry {
  key: BoardIconKind;
  label: string;
  color: string;
  Icon: typeof UserRound;
}

const ICON_CATALOG: IconCatalogEntry[] = [
  { key: 'person', label: 'Человек', color: '#2563eb', Icon: UserRound },
  { key: 'computer', label: 'Компьютер', color: '#0f766e', Icon: Computer },
  { key: 'server', label: 'Сервер', color: '#334155', Icon: Server },
  { key: 'database', label: 'База данных', color: '#7c3aed', Icon: Database },
  { key: 'network', label: 'Сеть', color: '#0891b2', Icon: Globe },
  { key: 'threat', label: 'Угроза', color: '#dc2626', Icon: ShieldAlert },
  { key: 'shield', label: 'Защита', color: '#16a34a', Icon: ShieldCheck },
];

const ENTITY_KIND_LABELS: Record<BoardEntityKind, string> = {
  external_host: 'Внешний хост',
  infrastructure: 'Инфраструктура',
  event: 'Событие',
  service: 'Сервис',
  note: 'Заметка',
};

const FONT_OPTIONS = [
  { value: 'Inter, sans-serif', label: 'Inter / Sans' },
  { value: 'Georgia, serif', label: 'Georgia / Serif' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet' },
  { value: 'Courier New, monospace', label: 'Courier New / Mono' },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClassName(status: string) {
  switch (status) {
    case 'Закрыт':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'В работе':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'Расследование':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Не удалось прочитать изображение.'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла.'));
    reader.readAsDataURL(file);
  });
}

function getIconEntry(icon: BoardIconKind) {
  return ICON_CATALOG.find((entry) => entry.key === icon) ?? ICON_CATALOG[1];
}

export default function BoardDetailPage() {
  useBoardsRealtimeSync();

  const { id } = useParams();
  const navigate = useNavigate();
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null);

  const boards = useBoardsStore((state) => state.boards);
  const addBoardMember = useBoardsStore((state) => state.addBoardMember);
  const removeBoardMember = useBoardsStore((state) => state.removeBoardMember);
  const leaveBoard = useBoardsStore((state) => state.leaveBoard);
  const deleteBoard = useBoardsStore((state) => state.deleteBoard);
  const addIncidentToBoard = useBoardsStore((state) => state.addIncidentToBoard);
  const addViolatorToBoard = useBoardsStore((state) => state.addViolatorToBoard);
  const addEntityToBoard = useBoardsStore((state) => state.addEntityToBoard);
  const addTextToBoard = useBoardsStore((state) => state.addTextToBoard);
  const addImageToBoard = useBoardsStore((state) => state.addImageToBoard);
  const addIconToBoard = useBoardsStore((state) => state.addIconToBoard);
  const moveBoardItem = useBoardsStore((state) => state.moveBoardItem);
  const removeBoardItem = useBoardsStore((state) => state.removeBoardItem);
  const connectBoardItems = useBoardsStore((state) => state.connectBoardItems);
  const clearBoardDrawing = useBoardsStore((state) => state.clearBoardDrawing);
  const clearBoardConnections = useBoardsStore((state) => state.clearBoardConnections);
  const addStroke = useBoardsStore((state) => state.addStroke);

  const incidents = useIncidentsStore((state) => state.incidents);
  const violators = useViolatorsStore((state) => state.violators);

  const board = useMemo(() => boards.find((entry) => entry.id === id), [boards, id]);

  const [mode, setMode] = useState<BoardToolMode>('select');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [violatorSearch, setViolatorSearch] = useState('');
  const [drawColor, setDrawColor] = useState('#2563eb');
  const [drawWidth, setDrawWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftStroke, setDraftStroke] = useState<BoardPoint[]>([]);
  const [dragItemState, setDragItemState] = useState<DragItemState | null>(null);
  const [selectedSourceItemId, setSelectedSourceItemId] = useState<string | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');

  const [entityKind, setEntityKind] = useState<BoardEntityKind>('external_host');
  const [entityTitle, setEntityTitle] = useState('');
  const [entityHost, setEntityHost] = useState('');
  const [entityDescription, setEntityDescription] = useState('');

  const [textContent, setTextContent] = useState('Комментарий аналитика');
  const [textFontFamily, setTextFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textFontSize, setTextFontSize] = useState(18);
  const [textFontWeight, setTextFontWeight] = useState<400 | 500 | 600 | 700>(500);
  const [textColor, setTextColor] = useState('#111827');

  const [imageUploadError, setImageUploadError] = useState('');

  const [iconKind, setIconKind] = useState<BoardIconKind>('computer');
  const [iconLabel, setIconLabel] = useState('Новый объект');
  const [iconColor, setIconColor] = useState('#0f766e');

  const incidentMap = useMemo(() => new Map(incidents.map((item) => [item.id, item])), [incidents]);
  const violatorMap = useMemo(() => new Map(violators.map((item) => [item.id, item])), [violators]);

  const isOwner = Boolean(board && board.ownerId === mockUser.id);

  useEffect(() => {
    if (mode !== 'connect') {
      setSelectedSourceItemId(null);
    }
  }, [mode]);

  const itemMap = useMemo(() => {
    return new Map((board?.items ?? []).map((item) => [item.id, item]));
  }, [board?.items]);

  const connectionLines = useMemo(() => {
    if (!board) {
      return [];
    }

    return board.connections
      .map((connection) => {
        const fromItem = itemMap.get(connection.fromItemId);
        const toItem = itemMap.get(connection.toItemId);
        if (!fromItem || !toItem) {
          return null;
        }
        return {
          id: connection.id,
          x1: fromItem.x + fromItem.width / 2,
          y1: fromItem.y + fromItem.height / 2,
          x2: toItem.x + toItem.width / 2,
          y2: toItem.y + toItem.height / 2,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [board, itemMap]);

  const incidentIdsOnBoard = useMemo(() => {
    return new Set((board?.items ?? []).filter((item) => item.type === 'incident').map((item) => item.incidentId));
  }, [board?.items]);

  const availableIncidents = useMemo(() => {
    if (!board) {
      return [];
    }

    const query = incidentSearch.trim().toLowerCase();
    return incidents
      .filter((incident) => incident.команда === board.team)
      .filter((incident) => !incidentIdsOnBoard.has(incident.id))
      .filter((incident) => {
        if (!query) {
          return true;
        }
        return (
          incident.название.toLowerCase().includes(query) ||
          incident.id.toLowerCase().includes(query) ||
          incident.login.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [board, incidentIdsOnBoard, incidentSearch, incidents]);

  const violatorIdsOnBoard = useMemo(() => {
    return new Set((board?.items ?? []).filter((item) => item.type === 'violator').map((item) => item.violatorId));
  }, [board?.items]);

  const availableViolators = useMemo(() => {
    const query = violatorSearch.trim().toLowerCase();
    return violators
      .filter((violator) => !violatorIdsOnBoard.has(violator.id))
      .filter((violator) => {
        if (!query) {
          return true;
        }
        return (
          violator.name.toLowerCase().includes(query) ||
          violator.samAccountName.toLowerCase().includes(query) ||
          violator.email.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [violatorSearch, violators, violatorIdsOnBoard]);

  const memberInviteCandidates = useMemo(() => {
    if (!board) {
      return [];
    }
    const memberIds = new Set(board.members.map((member) => member.id));
    return mockUsersDirectory.filter((user) => !memberIds.has(user.id));
  }, [board]);

  useEffect(() => {
    if (memberInviteCandidates.length === 0) {
      setInviteUserId('');
      return;
    }
    if (!memberInviteCandidates.some((user) => user.id === inviteUserId)) {
      setInviteUserId(memberInviteCandidates[0].id);
    }
  }, [inviteUserId, memberInviteCandidates]);

  const getBoardPoint = (clientX: number, clientY: number): BoardPoint | null => {
    const surface = boardSurfaceRef.current;
    if (!surface) {
      return null;
    }
    const rect = surface.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  useEffect(() => {
    if (!dragItemState || !board || mode !== 'select') {
      return;
    }

    const onMove = (event: PointerEvent) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      moveBoardItem(
        board.id,
        dragItemState.itemId,
        point.x - dragItemState.offsetX,
        point.y - dragItemState.offsetY
      );
    };

    const onUp = () => setDragItemState(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [board, dragItemState, mode, moveBoardItem]);

  const palette = ['#1d4ed8', '#ef4444', '#f59e0b', '#10b981', '#0f172a', '#7c3aed'];

  const handleDrawPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'draw') {
      return;
    }

    const point = getBoardPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    setIsDrawing(true);
    setDraftStroke([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDrawPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'draw' || !isDrawing) {
      return;
    }

    const point = getBoardPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    setDraftStroke((prev) => {
      const last = prev[prev.length - 1];
      if (!last) {
        return [point];
      }
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx * dx + dy * dy < 6) {
        return prev;
      }
      return [...prev, point];
    });
  };

  const finishDrawing = () => {
    if (!board || !isDrawing) {
      return;
    }

    setDraftStroke((points) => {
      if (points.length > 1) {
        addStroke(board.id, {
          color: drawColor,
          width: drawWidth,
          points,
          authorId: mockUser.id,
        });
      }
      return [];
    });
    setIsDrawing(false);
  };

  const handleItemPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    itemId: string,
    x: number,
    y: number
  ) => {
    if (mode !== 'select') {
      return;
    }
    const point = getBoardPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    event.preventDefault();
    setDragItemState({
      itemId,
      offsetX: point.x - x,
      offsetY: point.y - y,
    });
  };

  const handleItemClick = (itemId: string) => {
    if (!board || mode !== 'connect') {
      return;
    }

    if (!selectedSourceItemId) {
      setSelectedSourceItemId(itemId);
      return;
    }

    if (selectedSourceItemId === itemId) {
      setSelectedSourceItemId(null);
      return;
    }

    connectBoardItems(board.id, selectedSourceItemId, itemId);
    setSelectedSourceItemId(null);
  };

  const handleAddEntity = () => {
    if (!board || !entityTitle.trim()) {
      return;
    }

    addEntityToBoard(board.id, {
      kind: entityKind,
      title: entityTitle,
      host: entityHost,
      description: entityDescription,
    });

    setEntityTitle('');
    setEntityHost('');
    setEntityDescription('');
  };

  const handleAddText = () => {
    if (!board || !textContent.trim()) {
      return;
    }

    addTextToBoard(board.id, {
      text: textContent,
      fontFamily: textFontFamily,
      fontSize: textFontSize,
      fontWeight: textFontWeight,
      color: textColor,
    });
  };

  const handleAddIcon = () => {
    if (!board || !iconLabel.trim()) {
      return;
    }

    addIconToBoard(board.id, {
      icon: iconKind,
      label: iconLabel,
      color: iconColor,
    });

    setIconLabel('Новый объект');
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !board) {
      return;
    }

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setImageUploadError('Разрешены только PNG и JPG/JPEG.');
      return;
    }

    try {
      const src = await readImageAsDataUrl(file);
      addImageToBoard(board.id, {
        src,
        fileName: file.name,
        mimeType: file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      });
      setImageUploadError('');
    } catch {
      setImageUploadError('Не удалось загрузить изображение.');
    }
  };

  const handleLeaveBoard = () => {
    if (!board) {
      return;
    }
    if (window.confirm('Выйти из этой доски?')) {
      leaveBoard(board.id, mockUser.id);
      navigate('/boards');
    }
  };

  const handleDeleteBoard = () => {
    if (!board) {
      return;
    }
    if (window.confirm('Удалить доску целиком? Это действие нельзя отменить.')) {
      deleteBoard(board.id);
      navigate('/boards');
    }
  };

  const renderItemContent = (item: BoardCanvasItem) => {
    if (item.type === 'incident') {
      const incident = incidentMap.get(item.incidentId);
      if (!incident) {
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400">Инцидент не найден.</div>
        );
      }
      return (
        <>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            #{incident.id} {incident.название}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{incident.login}</div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusClassName(incident.статус)}`}>
              {incident.статус}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{incident.команда}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Ответственный: {incident.ответственный}</span>
            <Link
              to={`/incident/${incident.id}`}
              onClick={(event) => event.stopPropagation()}
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Открыть
            </Link>
          </div>
        </>
      );
    }

    if (item.type === 'violator') {
      const violator = violatorMap.get(item.violatorId);
      if (!violator) {
        return <div className="text-sm text-gray-500 dark:text-gray-400">Нарушитель не найден.</div>;
      }
      return (
        <>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{violator.name}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{violator.samAccountName}@{violator.domain}</div>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{violator.email}</div>
          <div className="mt-2 text-right">
            <Link
              to={`/violator/${violator.id}`}
              onClick={(event) => event.stopPropagation()}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Открыть карточку
            </Link>
          </div>
        </>
      );
    }

    if (item.type === 'entity') {
      return (
        <>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
          <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {ENTITY_KIND_LABELS[item.kind]}
          </div>
          {item.host && <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">Хост: {item.host}</div>}
          {item.description && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400" style={{ whiteSpace: 'pre-wrap' }}>
              {item.description}
            </div>
          )}
        </>
      );
    }

    if (item.type === 'text') {
      return (
        <div
          className="h-full w-full overflow-auto text-left"
          style={{
            fontFamily: item.fontFamily,
            fontSize: item.fontSize,
            fontWeight: item.fontWeight,
            color: item.color,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.35,
          }}
        >
          {item.text}
        </div>
      );
    }

    if (item.type === 'image') {
      return (
        <div className="h-full w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <img src={item.src} alt={item.fileName} className="h-full w-full object-cover" />
        </div>
      );
    }

    const icon = getIconEntry(item.icon);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <icon.Icon className="h-10 w-10" style={{ color: item.color }} />
        <div className="text-xs font-medium text-gray-700 dark:text-gray-200">{item.label}</div>
      </div>
    );
  };

  if (!board) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/boards')}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку досок
        </button>
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Доска не найдена или была удалена.
        </div>
      </div>
    );
  }

  const markerId = `board-arrow-${board.id}`;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <button
            onClick={() => navigate('/boards')}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к доскам
          </button>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{board.title}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{board.description || 'Без описания'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isOwner && (
            <button
              onClick={handleLeaveBoard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40"
            >
              <LogOut className="h-4 w-4" />
              Выйти из доски
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleDeleteBoard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              Удалить доску
            </button>
          )}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Realtime включен (вкладки/окна)
            </div>
            <div className="mt-1">Обновлено: {formatDateTime(board.updatedAt)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Участники</h3>
            {isOwner && memberInviteCandidates.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900">
                <select
                  value={inviteUserId}
                  onChange={(event) => setInviteUserId(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  {memberInviteCandidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (inviteUserId) {
                      addBoardMember(board.id, inviteUserId, 'editor');
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <UserRoundPlus className="h-3.5 w-3.5" />
                  Пригласить
                </button>
              </div>
            )}

            <div className="space-y-2">
              {board.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-900/70">
                  <div className="flex items-center gap-2">
                    <img src={member.avatar} alt={member.name} className="h-7 w-7 rounded-full" />
                    <div>
                      <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="rounded-md bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      {member.role}
                    </span>
                    {isOwner && member.role !== 'owner' && (
                      <button
                        onClick={() => removeBoardMember(board.id, member.id)}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-700"
                        title="Удалить пользователя из доски"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Добавить инцидент</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                value={incidentSearch}
                onChange={(event) => setIncidentSearch(event.target.value)}
                placeholder="Поиск по названию или login"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {availableIncidents.map((incident) => (
                <div key={incident.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100">#{incident.id} {incident.название}</div>
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{incident.login}</div>
                  <button
                    onClick={() => addIncidentToBoard(board.id, incident.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-3 w-3" />
                    Добавить
                  </button>
                </div>
              ))}
              {availableIncidents.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Нет доступных инцидентов.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Добавить нарушителя</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                value={violatorSearch}
                onChange={(event) => setViolatorSearch(event.target.value)}
                placeholder="Поиск по имени или login"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {availableViolators.map((violator) => (
                <div key={violator.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{violator.name}</div>
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{violator.samAccountName}@{violator.domain}</div>
                  <button
                    onClick={() => addViolatorToBoard(board.id, violator.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-3 w-3" />
                    Добавить
                  </button>
                </div>
              ))}
              {availableViolators.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Нет доступных нарушителей.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Кастомный блок</h3>
            <select
              value={entityKind}
              onChange={(event) => setEntityKind(event.target.value as BoardEntityKind)}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {(Object.keys(ENTITY_KIND_LABELS) as BoardEntityKind[]).map((kind) => (
                <option key={kind} value={kind}>{ENTITY_KIND_LABELS[kind]}</option>
              ))}
            </select>
            <input
              value={entityTitle}
              onChange={(event) => setEntityTitle(event.target.value)}
              placeholder="Название блока"
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={entityHost}
              onChange={(event) => setEntityHost(event.target.value)}
              placeholder="Хост/IP (опционально)"
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <textarea
              value={entityDescription}
              onChange={(event) => setEntityDescription(event.target.value)}
              rows={2}
              placeholder="Описание"
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              onClick={handleAddEntity}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-3 w-3" />
              Добавить блок
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Текст</h3>
            <textarea
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={textFontFamily}
                onChange={(event) => setTextFontFamily(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={12}
                max={42}
                value={textFontSize}
                onChange={(event) => setTextFontSize(Math.max(12, Math.min(42, Number(event.target.value) || 18)))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={String(textFontWeight)}
                onChange={(event) => setTextFontWeight(Number(event.target.value) as 400 | 500 | 600 | 700)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
              </select>
              <input
                type="color"
                value={textColor}
                onChange={(event) => setTextColor(event.target.value)}
                className="h-8 w-full rounded-lg border border-gray-300 bg-white px-1 py-1 dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
            <button
              onClick={handleAddText}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-3 w-3" />
              Добавить текст
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Изображение (PNG/JPG)</h3>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              <ImagePlus className="h-3.5 w-3.5" />
              Выбрать файл
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
            {imageUploadError && <div className="text-xs text-red-600 dark:text-red-400">{imageUploadError}</div>}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Иконка из набора</h3>
            <div className="grid grid-cols-2 gap-2">
              {ICON_CATALOG.map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => {
                    setIconKind(entry.key);
                    setIconColor(entry.color);
                    setIconLabel(entry.label);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors ${
                    iconKind === entry.key
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <entry.Icon className="h-3.5 w-3.5" />
                  {entry.label}
                </button>
              ))}
            </div>
            <input
              value={iconLabel}
              onChange={(event) => setIconLabel(event.target.value)}
              placeholder="Подпись"
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              type="color"
              value={iconColor}
              onChange={(event) => setIconColor(event.target.value)}
              className="h-8 w-full rounded-lg border border-gray-300 bg-white px-1 py-1 dark:border-gray-600 dark:bg-gray-900"
            />
            <button
              onClick={handleAddIcon}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-3 w-3" />
              Добавить иконку
            </button>
          </div>
        </aside>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: 'select', label: 'Выбор', icon: MousePointer2 },
                { key: 'draw', label: 'Рисование', icon: Paintbrush },
                { key: 'connect', label: 'Связи', icon: Link2 },
              ] as const).map((item) => {
                const Icon = item.icon;
                const isActive = mode === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setMode(item.key)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {mode === 'draw' && (
                <>
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
                    {palette.map((color) => (
                      <button
                        key={color}
                        onClick={() => setDrawColor(color)}
                        className={`h-5 w-5 rounded-full border-2 ${
                          drawColor === color ? 'border-gray-900 dark:border-gray-100' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    Толщина
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={drawWidth}
                      onChange={(event) => setDrawWidth(Number(event.target.value))}
                    />
                    {drawWidth}
                  </label>
                </>
              )}

              <button
                onClick={() => clearBoardDrawing(board.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Eraser className="h-4 w-4" />
                Очистить рисунок
              </button>
              <button
                onClick={() => clearBoardConnections(board.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Trash2 className="h-4 w-4" />
                Очистить связи
              </button>
            </div>
          </div>

          <div
            ref={boardSurfaceRef}
            className="relative h-[calc(100vh-255px)] min-h-[640px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.28) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <marker
                  id={markerId}
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
                </marker>
              </defs>

              {connectionLines.map((line) => (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#2563eb"
                  strokeWidth={2}
                  markerEnd={`url(#${markerId})`}
                  opacity={0.85}
                />
              ))}

              {board.strokes.map((stroke) => (
                <polyline
                  key={stroke.id}
                  points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                />
              ))}

              {draftStroke.length > 1 && (
                <polyline
                  points={draftStroke.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={drawColor}
                  strokeWidth={drawWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>

            <div
              className={`absolute inset-0 ${mode === 'draw' ? 'cursor-crosshair' : 'pointer-events-none'}`}
              onPointerDown={handleDrawPointerDown}
              onPointerMove={handleDrawPointerMove}
              onPointerUp={finishDrawing}
              onPointerCancel={finishDrawing}
              onPointerLeave={() => {
                if (isDrawing) {
                  finishDrawing();
                }
              }}
            />

            {board.items.map((item) => {
              const isSelectedSource = selectedSourceItemId === item.id;
              return (
                <div
                  key={item.id}
                  onPointerDown={(event) => handleItemPointerDown(event, item.id, item.x, item.y)}
                  onClick={() => handleItemClick(item.id)}
                  className={`absolute rounded-xl border bg-white p-3 shadow-md transition-shadow dark:bg-gray-900 ${
                    mode === 'select' ? 'cursor-grab active:cursor-grabbing' : ''
                  } ${mode === 'connect' ? 'cursor-pointer' : ''} ${
                    isSelectedSource
                      ? 'border-blue-500 ring-2 ring-blue-400/60'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                  }}
                >
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      removeBoardItem(board.id, item.id);
                    }}
                    className="absolute right-2 top-2 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                    title="Убрать с доски"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {renderItemContent(item)}
                </div>
              );
            })}

            {mode === 'connect' && (
              <div className="absolute left-3 top-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {selectedSourceItemId
                  ? 'Выберите второй блок, чтобы создать связь.'
                  : 'Нажмите первый блок для начала построения связи.'}
              </div>
            )}

            {board.items.length === 0 && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-dashed border-gray-300 bg-white/90 px-8 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-900/90 dark:text-gray-300">
                Добавьте блоки слева, чтобы начать построение схемы.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Участников: {board.members.length}
              </span>
              <span>Элементов: {board.items.length}</span>
              <span>Связей: {board.connections.length}</span>
              <span>Последнее изменение: {formatDateTime(board.updatedAt)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
