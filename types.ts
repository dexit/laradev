export type LaravelColumnType = 
  | 'id' 
  | 'string' 
  | 'text' 
  | 'integer' 
  | 'bigInteger' 
  | 'boolean' 
  | 'decimal' 
  | 'float' 
  | 'date' 
  | 'dateTime' 
  | 'timestamp' 
  | 'json'
  | 'foreignId';

export interface Column {
  id: string;
  name: string;
  type: LaravelColumnType;
  nullable: boolean;
  unique: boolean;
  default?: string;
  isPrimaryKey?: boolean;
}

export interface TableData {
  name: string;
  columns: Column[];
  comment?: string;
  color?: string; // For UI aesthetics
}

// React Flow specific types extension
import { Node, Edge } from 'reactflow';

export type TableNode = Node<TableData>;
export type RelationEdge = Edge;

export interface GeneratedCode {
  filename: string;
  content: string;
  type: 'migration' | 'model';
}
