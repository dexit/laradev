import React from 'react';
import { Handle, Position } from 'reactflow';
import { Column, LaravelColumnType } from '../types';
import { COLUMN_TYPES } from '../constants';
import { X, Key } from 'lucide-react';

interface ColumnRowProps {
  column: Column;
  onUpdate: (id: string, field: keyof Column, value: any) => void;
  onRemove: (id: string) => void;
}

export const ColumnRow: React.FC<ColumnRowProps> = ({ column, onUpdate, onRemove }) => {
  return (
    <div className="flex items-center gap-1 py-1.5 px-2 hover:bg-slate-50 rounded group relative border-b border-slate-50">
      {/* Field-to-field connection handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id={`col-${column.id}-target`} 
        className="!bg-slate-300 hover:!bg-indigo-500 !w-2 !h-2 -left-1 opacity-0 group-hover:opacity-100 transition-opacity" 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id={`col-${column.id}-source`} 
        className="!bg-slate-300 hover:!bg-indigo-500 !w-2 !h-2 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" 
      />

      {/* Primary Key / Indicator */}
      <div className="w-4 flex justify-center text-yellow-500 shrink-0">
        {column.type === 'id' ? (
          <Key size={12} fill="currentColor" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
        )}
      </div>

      {/* Column Name Input */}
      <input 
        type="text" 
        value={column.name}
        onChange={(e) => onUpdate(column.id, 'name', e.target.value)}
        className="nodrag w-24 bg-transparent text-xs font-mono border-b border-transparent focus:border-blue-500 outline-none px-1 text-slate-700 shrink-0"
        placeholder="name"
      />

      {/* Type Selector */}
      <select
        value={column.type}
        onChange={(e) => onUpdate(column.id, 'type', e.target.value as LaravelColumnType)}
        className="nodrag w-20 bg-transparent text-[10px] text-slate-500 font-semibold uppercase outline-none cursor-pointer hover:text-slate-700 shrink-0"
      >
        {COLUMN_TYPES.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* Default Value Input */}
      <input 
        type="text" 
        value={column.default || ''}
        onChange={(e) => onUpdate(column.id, 'default', e.target.value || undefined)}
        className="nodrag w-16 bg-transparent text-[10px] font-mono border-b border-dashed border-slate-200 focus:border-blue-500 outline-none px-1 text-slate-500 placeholder-slate-300 shrink-0"
        placeholder="def: value"
        title="Column Default Value"
      />

      {/* Toggles */}
      <div className="flex gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button 
          onClick={() => onUpdate(column.id, 'nullable', !column.nullable)}
          className={`px-1 text-[9px] rounded font-bold border transition-colors ${column.nullable ? 'bg-blue-100 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-400 bg-white hover:border-slate-300'}`}
          title="Nullable"
        >
          N
        </button>
        <button 
          onClick={() => onUpdate(column.id, 'unique', !column.unique)}
          className={`px-1 text-[9px] rounded font-bold border transition-colors ${column.unique ? 'bg-purple-100 border-purple-200 text-purple-700' : 'border-slate-200 text-slate-400 bg-white hover:border-slate-300'}`}
          title="Unique"
        >
          U
        </button>
        <button 
          onClick={() => onRemove(column.id)}
          className="p-0.5 text-slate-400 hover:text-red-500"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
