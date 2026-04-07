import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical } from 'lucide-react';

interface DraggableFieldProps {
  id: string;
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg?: React.CSSProperties;
  index: number;
  moveField: (dragIndex: number, hoverIndex: number) => void;
  action?: React.ReactNode;
  leftAction?: React.ReactNode;
  dragType?: string;
}

const FIELD_TYPE = 'FIELD';

export default function DraggableField({
  id,
  label,
  value,
  icon,
  iconBg,
  index,
  moveField,
  action,
  leftAction,
  dragType = FIELD_TYPE,
}: DraggableFieldProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: dragType,
    item: { index, id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const [, drop] = useDrop({
    accept: dragType,
    hover: (item: { index: number; id: string }, monitor) => {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;
      if (!monitor.isOver({ shallow: true })) return;

      moveField(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  return (
    <div
      ref={(node) => {
        ref.current = node;
        if (node) {
          drop(node);
          preview(node);
          drag(node);
        }
      }}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="cursor-move">
            <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          {leftAction}
        </div>
        
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={iconBg}>
          {icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            {action}
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
        </div>
      </div>
    </div>
  );
}
