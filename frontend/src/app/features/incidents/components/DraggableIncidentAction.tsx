import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical, Mail, ShieldAlert, UserPlus, Workflow, CheckCircle, Archive, Send, Download, X } from 'lucide-react';
import { IncidentAction } from '../../../store/incidentCollaboration.ts';

interface DraggableIncidentActionProps {
  action: IncidentAction;
  index: number;
  moveAction: (dragIndex: number, hoverIndex: number) => void;
  onRemove: (actionId: string) => void;
  readonly?: boolean;
  customContent?: ReactNode;
}

const ACTION_TYPE = 'INCIDENT_ACTION';

const toneClasses: Record<IncidentAction['tone'], string> = {
  blue: 'bg-blue-600 text-white hover:bg-blue-700',
  green: 'bg-green-600 text-white hover:bg-green-700',
  amber: 'bg-amber-500 text-white hover:bg-amber-600',
  red: 'bg-red-600 text-white hover:bg-red-700',
  slate: 'bg-gray-700 text-white hover:bg-gray-800',
};

function ActionIcon({ label }: { label: string }) {
  if (label.toLowerCase().includes('выгруз')) return <Download className="w-3.5 h-3.5" />;
  if (label.toLowerCase().includes('статус')) return <CheckCircle className="w-3.5 h-3.5" />;
  if (label.toLowerCase().includes('пись')) return <Mail className="w-3.5 h-3.5" />;
  if (label.toLowerCase().includes('связаться')) return <Send className="w-3.5 h-3.5" />;
  if (label.toLowerCase().includes('назнач')) return <UserPlus className="w-3.5 h-3.5" />;
  if (label.toLowerCase().includes('эскал')) return <ShieldAlert className="w-3.5 h-3.5" />;
  if (label.toLowerCase().includes('артефакт')) return <Archive className="w-3.5 h-3.5" />;
  return <Workflow className="w-3.5 h-3.5" />;
}

export default function DraggableIncidentAction({ action, index, moveAction, onRemove, readonly = false, customContent }: DraggableIncidentActionProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: ACTION_TYPE,
    item: { index, id: action.id },
    canDrag: !readonly,
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const [, drop] = useDrop({
    accept: ACTION_TYPE,
    hover: (item: { index: number; id: string }) => {
      if (readonly) return;
      if (!ref.current) return;
      if (item.index === index) return;
      moveAction(item.index, index);
      item.index = index;
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
      className={`inline-flex items-center gap-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      {!readonly && (
        <div ref={(node) => { if (node) drag(node); }} className="cursor-move">
          <GripVertical className="w-3.5 h-3.5 opacity-60 text-gray-500 dark:text-gray-300" />
        </div>
      )}
      {customContent ? (
        customContent
      ) : (
        <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${toneClasses[action.tone]}`}>
          <div className="flex h-5 w-5 items-center justify-center">
            <ActionIcon label={action.label} />
          </div>
          <div className="font-medium whitespace-nowrap">{action.label}</div>
        </div>
      )}
      {!readonly && (
        <button
          type="button"
          onClick={() => onRemove(action.id)}
          className="opacity-80 hover:opacity-100 text-gray-600 dark:text-gray-300"
          title="Скрыть действие"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
