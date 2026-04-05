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
  action
}: DraggableFieldProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: FIELD_TYPE,
    item: { index, id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const [, drop] = useDrop({
    accept: FIELD_TYPE,
    hover: (item: { index: number; id: string }, monitor) => {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      const isDraggingDown = dragIndex < hoverIndex;
      const isDraggingUp = dragIndex > hoverIndex;

      if (isDraggingDown && hoverClientY < hoverMiddleY) return;
      if (isDraggingUp && hoverClientY > hoverMiddleY) return;

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
        }
      }}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div ref={(node) => { if (node) drag(node); }} className="cursor-move pt-1">
          <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500" />
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
