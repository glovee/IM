import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, ChevronDown, MoreVertical, Pencil } from 'lucide-react';
import { Violator, ViolatorDynamicColumnKey } from '../../../../types/violator.ts';
import { ViolatorColumnDefinition, getViolatorColumnValueReact } from '../../../../config/violator-config.tsx';

interface ViolatorRowProps {
  violator: Violator;
  columns: ViolatorColumnDefinition[];
}

export default function ViolatorRow({ violator, columns }: ViolatorRowProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleDoubleClick = () => {
    navigate(`/violator/${violator.id}`);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleOpenInNewTab = () => {
    window.open(`/violator/${violator.id}`, '_blank');
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <>
      <div className="flex border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        {/* Expand button */}
        <div
          className="w-10 h-10 flex items-center justify-center border-r border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
        </div>

        {/* Column values */}
        <div
          className="flex flex-1 min-w-0 cursor-pointer"
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{ userSelect: 'text' }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="px-3 h-10 flex items-center text-sm text-gray-900 dark:text-gray-100 border-r border-gray-150 dark:border-gray-700 truncate flex-shrink-0"
              style={{ width: `${col.width}px`, userSelect: 'text' }}
            >
              {getViolatorColumnValueReact(violator, col.key)}
            </div>
          ))}
        </div>

        {/* Context menu button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            setContextMenu({ x: rect.left, y: rect.bottom });
          }}
          className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border-r border-gray-200 dark:border-gray-700"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1 px-4 py-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {columns.map((col) => (
                <div key={col.key} className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{col.label}</span>
                  <span className="text-gray-900 dark:text-gray-100">{getViolatorColumnValueReact(violator, col.key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} onMouseDown={closeContextMenu} />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-48"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                closeContextMenu();
                navigate(`/violator/${violator.id}`);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Pencil className="w-4 h-4" />
              Открыть нарушителя
            </button>
            <button
              onClick={() => {
                closeContextMenu();
                handleOpenInNewTab();
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Открыть в новой вкладке
            </button>
            <button
              onClick={() => {
                closeContextMenu();
                setIsExpanded(!isExpanded);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isExpanded ? 'Свернуть' : 'Развернуть'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
