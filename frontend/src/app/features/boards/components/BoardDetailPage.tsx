import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Eraser,
  Link2,
  MousePointer2,
  Paintbrush,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { mockUser } from '../../../data/mockData.ts';
import { useIncidentsStore } from '../../../store/incidents.ts';
import { useBoardsStore } from '../../../store/boardsStore.ts';
import { BoardPoint, BoardToolMode } from '../../../types/board.ts';
import { Incident } from '../../../types/incident.ts';
import { useBoardsRealtimeSync } from '../hooks/useBoardsRealtimeSync.ts';

interface DragNodeState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

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

export default function BoardDetailPage() {
  useBoardsRealtimeSync();

  const { id } = useParams();
  const navigate = useNavigate();
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null);

  const boards = useBoardsStore((state) => state.boards);
  const addIncidentToBoard = useBoardsStore((state) => state.addIncidentToBoard);
  const moveIncidentNode = useBoardsStore((state) => state.moveIncidentNode);
  const removeIncidentFromBoard = useBoardsStore((state) => state.removeIncidentFromBoard);
  const connectIncidentNodes = useBoardsStore((state) => state.connectIncidentNodes);
  const clearBoardDrawing = useBoardsStore((state) => state.clearBoardDrawing);
  const clearBoardConnections = useBoardsStore((state) => state.clearBoardConnections);
  const addStroke = useBoardsStore((state) => state.addStroke);
  const incidents = useIncidentsStore((state) => state.incidents);

  const board = useMemo(() => boards.find((entry) => entry.id === id), [boards, id]);

  const [mode, setMode] = useState<BoardToolMode>('select');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [drawColor, setDrawColor] = useState('#2563eb');
  const [drawWidth, setDrawWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftStroke, setDraftStroke] = useState<BoardPoint[]>([]);
  const [dragNodeState, setDragNodeState] = useState<DragNodeState | null>(null);
  const [selectedSourceNodeId, setSelectedSourceNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'connect') {
      setSelectedSourceNodeId(null);
    }
  }, [mode]);

  const incidentMap = useMemo(() => {
    return new Map(incidents.map((incident) => [incident.id, incident]));
  }, [incidents]);

  const nodeEntries = useMemo(() => {
    if (!board) {
      return [];
    }
    return board.incidentNodes
      .map((node) => ({ node, incident: incidentMap.get(node.incidentId) }))
      .filter((entry): entry is { node: typeof entry.node; incident: Incident } => Boolean(entry.incident));
  }, [board, incidentMap]);

  const nodesById = useMemo(() => {
    return new Map((board?.incidentNodes ?? []).map((node) => [node.id, node]));
  }, [board?.incidentNodes]);

  const connectionLines = useMemo(() => {
    if (!board) {
      return [];
    }

    return board.connections
      .map((connection) => {
        const fromNode = nodesById.get(connection.fromNodeId);
        const toNode = nodesById.get(connection.toNodeId);
        if (!fromNode || !toNode) {
          return null;
        }
        return {
          id: connection.id,
          x1: fromNode.x + fromNode.width / 2,
          y1: fromNode.y + fromNode.height / 2,
          x2: toNode.x + toNode.width / 2,
          y2: toNode.y + toNode.height / 2,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [board, nodesById]);

  const incidentIdsOnBoard = useMemo(() => {
    return new Set((board?.incidentNodes ?? []).map((node) => node.incidentId));
  }, [board?.incidentNodes]);

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
    if (!dragNodeState || !board || mode !== 'select') {
      return;
    }

    const onMove = (event: PointerEvent) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      moveIncidentNode(board.id, dragNodeState.nodeId, point.x - dragNodeState.offsetX, point.y - dragNodeState.offsetY);
    };

    const onUp = () => {
      setDragNodeState(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [board, dragNodeState, mode, moveIncidentNode]);

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

  const handleNodePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    nodeId: string,
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
    setDragNodeState({
      nodeId,
      offsetX: point.x - x,
      offsetY: point.y - y,
    });
  };

  const handleNodeClick = (nodeId: string) => {
    if (!board || mode !== 'connect') {
      return;
    }

    if (!selectedSourceNodeId) {
      setSelectedSourceNodeId(nodeId);
      return;
    }

    if (selectedSourceNodeId === nodeId) {
      setSelectedSourceNodeId(null);
      return;
    }

    connectIncidentNodes(board.id, selectedSourceNodeId, nodeId);
    setSelectedSourceNodeId(null);
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

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Realtime включен (вкладки/окна)
          </div>
          <div className="mt-1">Обновлено: {formatDateTime(board.updatedAt)}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Участники</h3>
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
                  <span className="rounded-md bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {member.role}
                  </span>
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

            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {availableIncidents.length > 0 ? (
                availableIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          #{incident.id} {incident.название}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{incident.login}</div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusClassName(incident.статус)}`}>
                        {incident.статус}
                      </span>
                    </div>
                    <button
                      onClick={() => addIncidentToBoard(board.id, incident.id)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Добавить
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Нет доступных инцидентов для добавления.
                </div>
              )}
            </div>
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
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.28) 1px, transparent 0)',
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

            {nodeEntries.map(({ node, incident }) => {
              const isSelectedSource = selectedSourceNodeId === node.id;
              return (
                <div
                  key={node.id}
                  onPointerDown={(event) => handleNodePointerDown(event, node.id, node.x, node.y)}
                  onClick={() => handleNodeClick(node.id)}
                  className={`absolute rounded-xl border bg-white p-3 shadow-md transition-shadow dark:bg-gray-900 ${
                    mode === 'select' ? 'cursor-grab active:cursor-grabbing' : ''
                  } ${mode === 'connect' ? 'cursor-pointer' : ''} ${
                    isSelectedSource
                      ? 'border-blue-500 ring-2 ring-blue-400/60'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    minHeight: node.height,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        #{incident.id} {incident.название}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{incident.login}</div>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        removeIncidentFromBoard(board.id, node.id);
                      }}
                      className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                      title="Убрать с доски"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

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
                </div>
              );
            })}

            {mode === 'connect' && (
              <div className="absolute left-3 top-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {selectedSourceNodeId
                  ? 'Выберите вторую карточку, чтобы создать связь.'
                  : 'Нажмите первую карточку для начала построения связи.'}
              </div>
            )}

            {board.incidentNodes.length === 0 && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-dashed border-gray-300 bg-white/90 px-8 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-900/90 dark:text-gray-300">
                Добавьте инциденты слева, чтобы начать построение схемы.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Участников: {board.members.length}
              </span>
              <span>Карточек на доске: {board.incidentNodes.length}</span>
              <span>Связей: {board.connections.length}</span>
              <span>Последнее изменение: {formatDateTime(board.updatedAt)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
