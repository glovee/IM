-- ============================================================
-- 002_seed_data.sql
-- Начальные справочные данные
-- ============================================================

-- ============================================================
-- Источники инцидентов
-- ============================================================

INSERT INTO incident_sources (name, display_name) VALUES
    ('siem', 'SIEM'),
    ('firewall', 'Firewall'),
    ('dlp', 'DLP System'),
    ('antivirus', 'Antivirus'),
    ('network_monitor', 'Network Monitor'),
    ('email_gateway', 'Email Gateway'),
    ('ueba', 'UEBA'),
    ('edr', 'EDR'),
    ('waf', 'WAF'),
    ('resource_monitor', 'Resource Monitor'),
    ('device_control', 'Device Control'),
    ('email_security', 'Email Security')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Статусы инцидентов
-- ============================================================

INSERT INTO incident_statuses (name, display_name, sort_order) VALUES
    ('open', 'Открыт', 10),
    ('in_progress', 'В работе', 20),
    ('investigation', 'Расследование', 30),
    ('closed', 'Закрыт', 40)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Типы инцидентов (seed для фронтенда)
-- ============================================================

-- Убедимся что типы существуют
INSERT INTO incident_types (code, name, description, sort_order) VALUES
    ('security', 'Безопасность', 'Инциденты безопасности и несанкционированного доступа', 10),
    ('dlp', 'DLP', 'Инциденты утечки и нарушения работы с данными', 20),
    ('network', 'Сеть', 'Сетевые аномалии и подозрительная активность', 30),
    ('malware', 'Вредоносное ПО', 'Детекты вредоносного ПО и заражения', 40)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Затронутые системы
-- ============================================================

INSERT INTO affected_systems (name, display_name) VALUES
    ('active_directory', 'Active Directory'),
    ('exchange', 'Exchange'),
    ('file_server', 'File Server'),
    ('vpn', 'VPN'),
    ('web_server', 'Web Server')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Команды (названия должны совпадать с frontend teamsStore)
-- ============================================================

INSERT INTO teams (name, description) VALUES
    ('SOC L1', 'Команда первой линии безопасности'),
    ('SOC L2', 'Команда второй линии безопасности'),
    ('SOC L3', 'Команда третьей линии безопасности'),
    ('Сеть', 'Команда сетевой безопасности'),
    ('DLP', 'Команда по предотвращению утечек данных')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Пользователи (демо-данные)
-- ============================================================

INSERT INTO users (username, display_name, email, role, team_id)
SELECT 'analyst1', 'Иванов Иван', 'analyst1@company.ru', 'analyst', t.id
FROM teams t WHERE t.name = 'SOC L1'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, display_name, email, role, team_id)
SELECT 'analyst2', 'Петров Пётр', 'analyst2@company.ru', 'analyst', t.id
FROM teams t WHERE t.name = 'SOC L2'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, display_name, email, role, team_id)
SELECT 'analyst3', 'Сидорова Анна', 'analyst3@company.ru', 'senior_analyst', t.id
FROM teams t WHERE t.name = 'DLP'
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, display_name, email, role, team_id)
SELECT 'admin', 'Администратор', 'admin@company.ru', 'admin', NULL
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Тестовые инциденты (демо-данные)
-- ============================================================

INSERT INTO incidents (id, title, host, login, date, source_id, status_id, incident_type_id, assignee_id, team_id, priority, detected_at, description, response_time, needs_escalation)
SELECT
    'a1111111-1111-4111-8111-111111111111',
    'Подозрительная активность в сети',
    'SRV-EDGE-01',
    'a.smirnov',
    '2026-03-26 10:30:00+00',
    (SELECT id FROM incident_sources WHERE name = 'siem'),
    (SELECT id FROM incident_statuses WHERE name = 'open'),
    (SELECT id FROM incident_types WHERE code = 'network'),
    (SELECT id FROM users WHERE username = 'analyst1'),
    (SELECT id FROM teams WHERE name = 'SOC L1'),
    'high',
    '2026-03-26 10:25:00+00',
    'Обнаружен аномальный исходящий трафик на внешний IP-адрес. Требуется расследование.',
    15,
    true
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, title, host, login, date, source_id, status_id, incident_type_id, assignee_id, team_id, priority, detected_at, description, response_time, needs_escalation)
SELECT
    'a2222222-2222-4222-8222-222222222222',
    'Попытка несанкционированного доступа',
    'GW-AUTH-02',
    'svc.vpn',
    '2026-03-26 09:15:00+00',
    (SELECT id FROM incident_sources WHERE name = 'firewall'),
    (SELECT id FROM incident_statuses WHERE name = 'in_progress'),
    (SELECT id FROM incident_types WHERE code = 'security'),
    (SELECT id FROM users WHERE username = 'analyst2'),
    (SELECT id FROM teams WHERE name = 'SOC L2'),
    'medium',
    '2026-03-26 09:10:00+00',
    'Серия неудачных попыток входа в VPN. IP заблокирован автоматически.',
    5,
    false
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, title, host, login, date, source_id, status_id, incident_type_id, assignee_id, team_id, priority, detected_at, description, response_time, needs_escalation)
SELECT
    'a3333333-3333-4333-8333-333333333333',
    'Утечка конфиденциальных данных',
    'WS-DLP-014',
    'user.name',
    '2026-03-26 08:00:00+00',
    (SELECT id FROM incident_sources WHERE name = 'dlp'),
    (SELECT id FROM incident_statuses WHERE name = 'investigation'),
    (SELECT id FROM incident_types WHERE code = 'dlp'),
    (SELECT id FROM users WHERE username = 'analyst3'),
    (SELECT id FROM teams WHERE name = 'DLP'),
    'critical',
    '2026-03-26 07:45:00+00',
    'Попытка отправки конфиденциальных документов на личную почту. Файлы заблокированы.',
    30,
    true
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, title, host, login, date, source_id, status_id, incident_type_id, assignee_id, team_id, priority, detected_at, description, response_time, needs_escalation)
SELECT
    'a4444444-4444-4444-8444-444444444444',
    'Вредоносное ПО обнаружено',
    'WKS-USER-042',
    'p.sidorov',
    '2026-03-25 16:45:00+00',
    (SELECT id FROM incident_sources WHERE name = 'antivirus'),
    (SELECT id FROM incident_statuses WHERE name = 'closed'),
    (SELECT id FROM incident_types WHERE code = 'malware'),
    (SELECT id FROM users WHERE username = 'analyst1'),
    (SELECT id FROM teams WHERE name = 'SOC L1'),
    'high',
    '2026-03-25 16:40:00+00',
    'Обнаружен троян GenericKD. Файл удалён, система проверена.',
    10,
    false
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, title, host, login, date, source_id, status_id, incident_type_id, assignee_id, team_id, priority, detected_at, description, response_time, needs_escalation)
SELECT
    'a5555555-5555-5555-8555-555555555555',
    'Аномальный трафик к внешнему IP',
    'FW-CORE-02',
    'net.monitor',
    '2026-03-26 11:20:00+00',
    (SELECT id FROM incident_sources WHERE name = 'network_monitor'),
    (SELECT id FROM incident_statuses WHERE name = 'open'),
    (SELECT id FROM incident_types WHERE code = 'network'),
    (SELECT id FROM users WHERE username = 'analyst2'),
    (SELECT id FROM teams WHERE name = 'SOC L2'),
    'medium',
    '2026-03-26 11:15:00+00',
    'Зафиксирован всплеск трафика на подозрительный внешний IP. Требуется анализ.',
    20,
    false
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, title, host, login, date, source_id, status_id, incident_type_id, assignee_id, team_id, priority, detected_at, description, response_time, needs_escalation)
SELECT
    'a6666666-6666-6666-8666-666666666666',
    'Отправка файлов на личную почту',
    'MAIL-GW-01',
    'employee',
    '2026-03-26 07:30:00+00',
    (SELECT id FROM incident_sources WHERE name = 'email_gateway'),
    (SELECT id FROM incident_statuses WHERE name = 'in_progress'),
    (SELECT id FROM incident_types WHERE code = 'dlp'),
    (SELECT id FROM users WHERE username = 'analyst3'),
    (SELECT id FROM teams WHERE name = 'DLP'),
    'high',
    '2026-03-26 07:25:00+00',
    'Сотрудник пытался отправить коммерческие документы на внешний email.',
    25,
    true
ON CONFLICT (id) DO NOTHING;
