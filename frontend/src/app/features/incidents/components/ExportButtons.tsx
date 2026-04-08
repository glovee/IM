import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileArchive } from 'lucide-react';
import { Incident } from '../../../types/incident.ts';
import { exportApi } from '../../../api/client.ts';

interface ExportButtonsProps {
  incident: Incident;
}

export default function ExportButtons({ incident }: ExportButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleExportFiles = () => {
    window.open(exportApi.incidentFiles(incident.id), '_blank');
  };

  const handleExportFilesAndCard = () => {
    window.open(exportApi.incidentCard(incident.id), '_blank');
  };

  const handleExportByViolator = () => {
    window.open(exportApi.byViolator(incident.login), '_blank');
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleExportAction = (action: 'files' | 'files_card' | 'by_violator') => {
    if (action === 'files') handleExportFiles();
    if (action === 'files_card') handleExportFilesAndCard();
    if (action === 'by_violator') handleExportByViolator();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        Выгрузка
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 min-w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
          <button
            onClick={() => handleExportAction('files')}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Выгрузить файлы
          </button>
          <button
            onClick={() => handleExportAction('files_card')}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
          >
            <FileArchive className="w-4 h-4" />
            Файлы + карточка
          </button>
          <button
            onClick={() => handleExportAction('by_violator')}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Все по нарушителю
          </button>
        </div>
      )}
    </div>
  );
}
