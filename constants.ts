import { LaravelColumnType } from './types';

export const COLUMN_TYPES: LaravelColumnType[] = [
  'id',
  'string',
  'text',
  'integer',
  'bigInteger',
  'boolean',
  'decimal',
  'float',
  'date',
  'dateTime',
  'timestamp',
  'json',
  'foreignId'
];

export const COLORS = [
  '#f87171', // Red
  '#fb923c', // Orange
  '#facc15', // Yellow
  '#4ade80', // Green
  '#2dd4bf', // Teal
  '#60a5fa', // Blue
  '#818cf8', // Indigo
  '#a78bfa', // Purple
  '#f472b6', // Pink
];

export const DEFAULT_COLUMNS = [
  { id: '1', name: 'id', type: 'id' as const, nullable: false, unique: true, isPrimaryKey: true },
  { id: '2', name: 'created_at', type: 'timestamp' as const, nullable: true, unique: false },
  { id: '3', name: 'updated_at', type: 'timestamp' as const, nullable: true, unique: false },
];
