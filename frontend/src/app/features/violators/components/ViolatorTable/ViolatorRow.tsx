import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, ChevronDown, Pencil } from 'lucide-react';
import { Violator, ViolatorDynamicColumnKey } from '../../../../types/violator.ts';
import { getIconComponent, ViolatorColumnDefinition, getViolatorColumnValueReact } from '../../../../config/violator-config.tsx';
import { useViolatorFieldsStore } from '../../../../store/violatorFieldsStore.ts';

interface ViolatorRowProps {
  violator: Violator;
  columns: ViolatorColumnDefinition[];
}

export default function ViolatorRow({ violator, columns }: ViolatorRowProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const baseFields = useViolatorFieldsStore((state) => state.baseFields);
  const extraFields = useViolatorFieldsStore((state) => state.extraFields);

  const handleDoubleClick = () => {
    navigate(`/violator/${violator.id}`);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      window.open(`/violator/${violator.id}`, '_blank');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleOpenInNewTab = () => {
    window.open(`/violator/${violator.id}`, '_blank');
  };

  const closeContextMenu = () => setContextMenu(null);

  const requiredDetails = useMemo(() => {
    return baseFields.map((field) => {
      const Icon = getIconComponent(field.icon);
      return {
        key: field.id,
        label: field.name,
        value: getViolatorColumnValueReact(violator, field.id as ViolatorDynamicColumnKey),
        icon: <Icon className="w-5 h-5" style={{ color: field.iconColor }} />,
        iconBg: { backgroundColor: `${field.iconColor}20` },
      };
    });
  }, [baseFields, violator]);

  const extraDetails = useMemo(() => {
    return extraFields.map((field) => {
      const Icon = getIconComponent(field.icon);
      return {
        key: field.id,
        label: field.name,
        value: getViolatorColumnValueReact(violator, `custom:${field.id}`),
        icon: <Icon className="w-5 h-5" style={{ color: field.iconColor }} />,
        iconBg: { backgroundColor: `${field.iconColor}20` },
      };
    });
  }, [extraFields, violator]);

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
          onAuxClick={handleAuxClick}
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
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="max-w-6xl space-y-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {requiredDetails.map((detail) => (
                  <div key={detail.key} className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={detail.iconBg}>
                      {detail.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{detail.label}</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{detail.value}</div>
                      {detail.key === 'name' && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          ID: {violator.id}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {extraDetails.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Дополнительные поля</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {extraDetails.map((detail) => (
                    <div key={detail.key} className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={detail.iconBg}>
                        {detail.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{detail.label}</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{detail.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
