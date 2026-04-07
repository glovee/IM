import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  Clock3,
  LogOut,
  PanelsTopLeft,
  Plus,
  Shield,
  Trash2,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { mockUser, mockUsersDirectory } from '../../../data/mockData.ts';
import { useTeamsStore } from '../../../store/teamsStore.ts';
import { useBoardsStore } from '../../../store/boardsStore.ts';
import { Board } from '../../../types/board.ts';
import { useBoardsRealtimeSync } from '../hooks/useBoardsRealtimeSync.ts';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface BoardCardProps {
  board: Board;
  isOwner: boolean;
  onOpen: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  onLeave: (boardId: string) => void;
}

function BoardCard({ board, isOwner, onOpen, onDelete, onLeave }: BoardCardProps) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="overflow-hidden text-base font-semibold text-gray-900 dark:text-gray-100"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
            title={board.title}
          >
            {board.title}
          </h3>
          <p
            className="mt-1 overflow-hidden text-sm text-gray-600 dark:text-gray-300"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
            title={board.description || 'Без описания'}
          >
            {board.description || 'Без описания'}
          </p>
        </div>
        <span className="inline-flex shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {board.team}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <PanelsTopLeft className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          Элементов: <span className="font-medium text-gray-700 dark:text-gray-200">{board.items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          Связей: <span className="font-medium text-gray-700 dark:text-gray-200">{board.connections.length}</span>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          Обновлено: <span className="font-medium text-gray-700 dark:text-gray-200">{formatDateTime(board.updatedAt)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {board.members.slice(0, 4).map((member) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                title={member.name}
                className="h-7 w-7 rounded-full border-2 border-white dark:border-gray-800"
              />
            ))}
          </div>
          {board.members.length > 4 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">+{board.members.length - 4}</span>
          )}
        </div>

        <button
          onClick={() => onOpen(board.id)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Открыть
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {!isOwner && (
          <div className="inline-flex rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Приглашение
          </div>
        )}
        <div className="ml-auto">
          {isOwner ? (
            <button
              onClick={() => onDelete(board.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </button>
          ) : (
            <button
              onClick={() => onLeave(board.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40"
            >
              <LogOut className="h-3.5 w-3.5" />
              Выйти
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function BoardsPage() {
  useBoardsRealtimeSync();

  const navigate = useNavigate();
  const boards = useBoardsStore((state) => state.boards);
  const createBoard = useBoardsStore((state) => state.createBoard);
  const deleteBoard = useBoardsStore((state) => state.deleteBoard);
  const leaveBoard = useBoardsStore((state) => state.leaveBoard);
  const teams = useTeamsStore((state) => state.teams);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [team, setTeam] = useState(teams[0]?.name ?? 'SOC L1');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (teams.length > 0 && !teams.some((entry) => entry.name === team)) {
      setTeam(teams[0].name);
    }
  }, [team, teams]);

  const myBoards = useMemo(() => boards.filter((board) => board.ownerId === mockUser.id), [boards]);

  const invitedBoards = useMemo(
    () =>
      boards.filter(
        (board) =>
          board.ownerId !== mockUser.id &&
          board.members.some((member) => member.id === mockUser.id)
      ),
    [boards]
  );

  const inviteCandidates = useMemo(() => mockUsersDirectory.filter((user) => user.id !== mockUser.id), []);

  const resetDialog = () => {
    setTitle('');
    setDescription('');
    setTeam(teams[0]?.name ?? 'SOC L1');
    setMemberIds([]);
    setIsDialogOpen(false);
  };

  const toggleMember = (userId: string) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateBoard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    const boardId = createBoard({
      title,
      description,
      team,
      memberIds,
    });
    resetDialog();
    navigate(`/boards/${boardId}`);
  };

  const handleDeleteBoard = (boardId: string) => {
    if (window.confirm('Удалить доску? Это действие нельзя отменить.')) {
      deleteBoard(boardId);
    }
  };

  const handleLeaveBoard = (boardId: string) => {
    if (window.confirm('Выйти из доски? Вы перестанете видеть ее в списке приглашений.')) {
      leaveBoard(boardId, mockUser.id);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Доски</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Совместное пространство для построения цепочек атаки, схем и расследований.
          </p>
        </div>

        <button
          onClick={() => setIsDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Добавить доску
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <PanelsTopLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Мои доски</h3>
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {myBoards.length}
          </span>
        </div>

        {myBoards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                isOwner={true}
                onOpen={(boardId) => navigate(`/boards/${boardId}`)}
                onDelete={handleDeleteBoard}
                onLeave={handleLeaveBoard}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            У вас пока нет досок. Создайте первую доску для расследования.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Доски, куда меня пригласили</h3>
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {invitedBoards.length}
          </span>
        </div>

        {invitedBoards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {invitedBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                isOwner={false}
                onOpen={(boardId) => navigate(`/boards/${boardId}`)}
                onDelete={handleDeleteBoard}
                onLeave={handleLeaveBoard}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            Пока нет приглашений на доски.
          </div>
        )}
      </section>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <form
            onSubmit={handleCreateBoard}
            className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Новая доска</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Создайте рабочее пространство и сразу пригласите аналитиков.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">Название</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например: Attack graph #12"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">Описание</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Короткое описание сценария расследования"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">Команда</label>
                <select
                  value={team}
                  onChange={(event) => setTeam(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                >
                  {teams.map((teamOption) => (
                    <option key={teamOption.id} value={teamOption.name}>
                      {teamOption.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <UserRoundPlus className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Пригласить в доску</label>
                </div>
                <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                  {inviteCandidates.map((user) => {
                    const isChecked = memberIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMember(user.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <img src={user.avatar} alt={user.name} className="h-7 w-7 rounded-full" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
              <button
                type="button"
                onClick={resetDialog}
                className="rounded-lg px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Создать доску
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
