import { useState } from 'react';
import { Plus, Trash2, Shield, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { useViolatorFieldsStore } from '../../../store/violatorFieldsStore.ts';

type DirectoryConnectionType = 'LDAP' | 'LDAPS' | 'GlobalLDAP' | 'GlobalLDAPS';

const directoryConnectionOptions = [
  { value: 'LDAP', label: 'LDAP (389)' },
  { value: 'LDAPS', label: 'LDAPS (636)' },
  { value: 'GlobalLDAP', label: 'GlobalLDAP (3268)' },
  { value: 'GlobalLDAPS', label: 'GlobalLDAPS (3269)' },
] as const;

interface Domain {
  id: string;
  domainName: string;
  controllerIp: string;
  username: string;
  password: string;
  connectionType: DirectoryConnectionType;
}

interface ADFieldMapping {
  adFieldName: string;
  systemFieldId: string;
}

const COMMON_AD_FIELDS = [
  { value: 'extensionAttribute1', label: 'extensionAttribute1' },
  { value: 'extensionAttribute2', label: 'extensionAttribute2' },
  { value: 'extensionAttribute3', label: 'extensionAttribute3' },
  { value: 'extensionAttribute4', label: 'extensionAttribute4' },
  { value: 'extensionAttribute5', label: 'extensionAttribute5' },
  { value: 'extensionAttribute6', label: 'extensionAttribute6' },
  { value: 'extensionAttribute7', label: 'extensionAttribute7' },
  { value: 'extensionAttribute8', label: 'extensionAttribute8' },
  { value: 'extensionAttribute9', label: 'extensionAttribute9' },
  { value: 'extensionAttribute10', label: 'extensionAttribute10' },
  { value: 'employeeID', label: 'employeeID' },
  { value: 'employeeNumber', label: 'employeeNumber' },
  { value: 'department', label: 'department' },
  { value: 'company', label: 'company' },
  { value: 'title', label: 'title' },
  { value: 'physicalDeliveryOfficeName', label: 'physicalDeliveryOfficeName' },
  { value: 'telephoneNumber', label: 'telephoneNumber' },
  { value: 'mobile', label: 'mobile' },
  { value: 'mail', label: 'mail' },
  { value: 'sAMAccountName', label: 'sAMAccountName' },
  { value: 'displayName', label: 'displayName' },
  { value: 'sn', label: 'sn (Surname)' },
  { value: 'givenName', label: 'givenName' },
];

export default function ActiveDirectorySettings() {
  const [domains, setDomains] = useState<Domain[]>([
    {
      id: '1',
      domainName: 'corp.local',
      controllerIp: '10.10.10.10',
      username: 'svc_im_sync@corp.local',
      password: '',
      connectionType: 'LDAPS',
    }
  ]);

  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<ADFieldMapping[]>([]);
  const baseFields = useViolatorFieldsStore((state) => state.baseFields);
  const extraFields = useViolatorFieldsStore((state) => state.extraFields);
  const allViolatorFields = [...baseFields, ...extraFields];

  const addDomain = () => {
    const newDomain: Domain = {
      id: Date.now().toString(),
      domainName: '',
      controllerIp: '',
      username: '',
      password: '',
      connectionType: 'LDAP'
    };
    setDomains([...domains, newDomain]);
  };

  const removeDomain = (id: string) => {
    setDomains(domains.filter(d => d.id !== id));
  };

  const updateDomain = (id: string, field: keyof Domain, value: string) => {
    setDomains(domains.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addMapping = () => {
    setFieldMappings([...fieldMappings, { adFieldName: '', systemFieldId: '' }]);
  };

  const removeMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof ADFieldMapping, value: string) => {
    setFieldMappings(fieldMappings.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const getUsedSystemFieldIds = () => {
    return fieldMappings.map(m => m.systemFieldId);
  };

  const getAvailableSystemFields = (currentIndex: number) => {
    const usedIds = getUsedSystemFieldIds().filter((_, i) => i !== currentIndex);
    return allViolatorFields.filter(f => !usedIds.includes(f.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Настройка Active Directory</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Добавьте подключения к Active Directory для интеграции с системой
        </p>
      </div>

      <div className="space-y-4">
        {domains.map((domain, index) => (
          <div key={domain.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Подключение AD {index + 1}</h4>
                  <p className="text-xs text-blue-800 dark:text-blue-400">
                    Укажите параметры подключения к контроллеру домена
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeDomain(domain.id)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                  Имя домена
                </label>
                <input
                  type="text"
                  value={domain.domainName}
                  onChange={(e) => updateDomain(domain.id, 'domainName', e.target.value)}
                  placeholder="corp.local"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                  IP контроллера
                </label>
                <input
                  type="text"
                  value={domain.controllerIp}
                  onChange={(e) => updateDomain(domain.id, 'controllerIp', e.target.value)}
                  placeholder="10.10.10.10"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                  Пользователь
                </label>
                <input
                  type="text"
                  value={domain.username}
                  onChange={(e) => updateDomain(domain.id, 'username', e.target.value)}
                  placeholder="svc_im_sync@corp.local"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                  Пароль
                </label>
                <input
                  type="password"
                  value={domain.password}
                  onChange={(e) => updateDomain(domain.id, 'password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                  Тип подключения
                </label>
                <select
                  value={domain.connectionType}
                  onChange={(e) => updateDomain(domain.id, 'connectionType', e.target.value)}
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  {directoryConnectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={addDomain}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить домен
        </button>

        <button
          onClick={() => setIsMappingOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          Маппинг полей AD
        </button>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Сохранить настройки
        </button>
      </div>

      {/* Dialog для маппинга полей */}
      <Dialog open={isMappingOpen} onOpenChange={setIsMappingOpen}>
        <DialogContent className="sm:max-w-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Маппинг полей Active Directory</DialogTitle>
            <DialogDescription>
              Настройте соответствие между полями AD и полями нарушителя в системе.
              При инциденте данные нарушителя будут автоматически подтягиваться из AD.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Поля нарушителя, доступные для маппинга
              </div>
              <button
                onClick={addMapping}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Добавить соответствие
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {fieldMappings.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  Нет настроенных соответствий. Нажмите «Добавить соответствие» для начала.
                </div>
              ) : (
                fieldMappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Поле в Active Directory
                      </label>
                      <input
                        type="text"
                        list="ad-common-fields"
                        value={mapping.adFieldName}
                        onChange={(e) => updateMapping(index, 'adFieldName', e.target.value)}
                        placeholder="Например: extensionAttribute1"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="text-gray-400 dark:text-gray-500 pt-5">
                      →
                    </div>

                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Поле в системе
                      </label>
                      <select
                        value={mapping.systemFieldId}
                        onChange={(e) => updateMapping(index, 'systemFieldId', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Выберите поле...</option>
                        {getAvailableSystemFields(index).map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.name} ({field.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => removeMapping(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors mt-5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <datalist id="ad-common-fields">
              {COMMON_AD_FIELDS.map((adField) => (
                <option key={adField.value} value={adField.value}>
                  {adField.label}
                </option>
              ))}
            </datalist>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Поля нарушителя:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                {allViolatorFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span>{field.name} (ID: {field.id})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsMappingOpen(false)}
              className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={() => {
                // TODO: Save field mappings
                setIsMappingOpen(false);
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Сохранить
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
