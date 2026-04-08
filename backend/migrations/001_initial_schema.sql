-- ============================================================
-- 001_initial_schema.sql
-- Основная схема базы данных Incident Management
-- PostgreSQL 18
-- ============================================================

-- Включение расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Справочные таблицы (ENUM-подобные)
-- ============================================================

-- Источники инцидентов
CREATE TABLE incident_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Статусы инцидентов
CREATE TABLE incident_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Типы инцидентов
CREATE TABLE incident_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Затронутые системы
CREATE TABLE affected_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Основные таблицы
-- ============================================================

-- Команды / отделы
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Пользователи (аналитики, нарушители и т.д.)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Основная таблица инцидентов
-- ============================================================

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Базовые поля (baseFields)
    title VARCHAR(300) NOT NULL,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source_id UUID REFERENCES incident_sources(id) ON DELETE RESTRICT,
    host VARCHAR(255) NOT NULL,
    login VARCHAR(100) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status_id UUID REFERENCES incident_statuses(id) ON DELETE RESTRICT,
    date TIMESTAMPTZ NOT NULL,

    -- Тип инцидента
    incident_type_id UUID REFERENCES incident_types(id) ON DELETE RESTRICT,

    -- Дополнительные поля (денормализованные наиболее используемые)
    priority VARCHAR(20) CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    detected_at TIMESTAMPTZ,
    description TEXT,
    response_time INTEGER, -- в минутах
    needs_escalation BOOLEAN DEFAULT FALSE,

    -- Метаданные
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- soft delete (корзина)

    -- Индексы и ограничения
    CONSTRAINT incidents_title_not_empty CHECK (char_length(title) > 0),
    CONSTRAINT incidents_host_not_empty CHECK (char_length(host) > 0)
);

-- Индексы для производительности
CREATE INDEX idx_incidents_status ON incidents(status_id);
CREATE INDEX idx_incidents_type ON incidents(incident_type_id);
CREATE INDEX idx_incidents_assignee ON incidents(assignee_id);
CREATE INDEX idx_incidents_date ON incidents(date DESC);
CREATE INDEX idx_incidents_priority ON incidents(priority);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX idx_incidents_deleted_at ON incidents(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_incidents_host ON incidents(host);
CREATE INDEX idx_incidents_login ON incidents(login);

-- ============================================================
-- Связанные таблицы
-- ============================================================

-- Файлы инцидента (списокФайлов)
CREATE TABLE incident_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incident_files_incident ON incident_files(incident_id);

-- Затронутые системы инцидента (множественный выбор)
CREATE TABLE incident_affected_systems (
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    affected_system_id UUID NOT NULL REFERENCES affected_systems(id) ON DELETE CASCADE,
    PRIMARY KEY (incident_id, affected_system_id)
);

-- Дополнительные поля инцидента (EAV для кастомных полей)
CREATE TABLE incident_custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('string', 'multiline', 'datetime', 'number', 'boolean', 'select', 'multiselect', 'file')),
    value_text TEXT,
    value_number NUMERIC,
    value_boolean BOOLEAN,
    value_datetime TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (incident_id, field_key)
);

CREATE INDEX idx_incident_custom_fields_incident ON incident_custom_fields(incident_id);
CREATE INDEX idx_incident_custom_fields_key ON incident_custom_fields(field_key);

-- ============================================================
-- Расследование / Collaboration
-- ============================================================

-- Записи расследования (комментарии, email)
CREATE TABLE investigation_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('comment', 'email_out', 'email_in')),
    parent_id UUID REFERENCES investigation_entries(id) ON DELETE CASCADE,
    thread_root_id UUID REFERENCES investigation_entries(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    recipient VARCHAR(255),
    subject VARCHAR(500),
    template_name VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investigation_entries_incident ON investigation_entries(incident_id);
CREATE INDEX idx_investigation_entries_thread ON investigation_entries(thread_root_id);
CREATE INDEX idx_investigation_entries_parent ON investigation_entries(parent_id);

-- Уведомления пользователей
CREATE TABLE user_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_user_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = FALSE;

-- Вложения расследования
CREATE TABLE investigation_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES investigation_entries(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investigation_attachments_entry ON investigation_attachments(entry_id);

-- ============================================================
-- Триггер для автоматического обновления updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
