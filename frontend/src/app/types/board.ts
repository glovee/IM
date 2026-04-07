import { IncidentTeam, User } from './incident.ts';

export type BoardMemberRole = 'owner' | 'editor' | 'viewer';
export type BoardToolMode = 'select' | 'draw' | 'connect';

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

export interface BoardIncidentNode {
  id: string;
  incidentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
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
  incidentNodes: BoardIncidentNode[];
  connections: BoardConnection[];
}
