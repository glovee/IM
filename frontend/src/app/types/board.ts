import { IncidentTeam, User } from './incident.ts';

export type BoardMemberRole = 'owner' | 'editor' | 'viewer';
export type BoardToolMode = 'select' | 'draw' | 'connect';
export type BoardEntityKind = 'external_host' | 'infrastructure' | 'event' | 'service' | 'note';
export type BoardIconKind =
  | 'person'
  | 'computer'
  | 'server'
  | 'database'
  | 'network'
  | 'threat'
  | 'shield';

export interface BoardMember extends User {
  role: BoardMemberRole;
}

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardStroke {
  id: string;
  authorId: string;
  color: string;
  width: number;
  points: BoardPoint[];
  createdAt: string;
}

export interface BoardCanvasItemBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardIncidentItem extends BoardCanvasItemBase {
  type: 'incident';
  incidentId: string;
}

export interface BoardViolatorItem extends BoardCanvasItemBase {
  type: 'violator';
  violatorId: string;
}

export interface BoardEntityItem extends BoardCanvasItemBase {
  type: 'entity';
  kind: BoardEntityKind;
  title: string;
  host?: string;
  description?: string;
}

export interface BoardTextItem extends BoardCanvasItemBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
}

export interface BoardImageItem extends BoardCanvasItemBase {
  type: 'image';
  src: string;
  fileName: string;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface BoardIconItem extends BoardCanvasItemBase {
  type: 'icon';
  icon: BoardIconKind;
  label: string;
  color: string;
}

export type BoardCanvasItem =
  | BoardIncidentItem
  | BoardViolatorItem
  | BoardEntityItem
  | BoardTextItem
  | BoardImageItem
  | BoardIconItem;

export interface BoardConnection {
  id: string;
  fromItemId: string;
  toItemId: string;
}

export interface Board {
  id: string;
  title: string;
  description: string;
  team: IncidentTeam;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: BoardMember[];
  strokes: BoardStroke[];
  items: BoardCanvasItem[];
  connections: BoardConnection[];
}
