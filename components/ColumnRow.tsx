import React from 'react';
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
    <div className="flex items-center gap-1 py-1 px-1 hover:bg-black/5 rounded group relative">
      {/* Primary Key Indicator */}
      <div className="w-4 flex justify-center text-yellow-500">
        {column.type === 'id' && <Key size={12} fill="currentColor" />}
      </div>

      {/* Column Name Input */}
      <input 
        type="text" 
        value={column.name}
        onChange={(e) => onUpdate(column.id, 'name', e.target.value)}
        className="nodrag w-28 bg-transparent text-xs font-mono border-b border-transparent focus:border-blue-500 outline-none px-1 text-slate-700"
        placeholder="col_name"
      />

      {/* Type Selector */}
      <select
        value={column.type}
        onChange={(e) => onUpdate(column.id, 'type', e.target.value as LaravelColumnType)}
        className="nodrag w-24 bg-transparent text-[10px] text-slate-500 font-medium uppercase outline-none cursor-pointer hover:text-slate-700"
      >
        {COLUMN_TYPES.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* Toggles */}
      <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onUpdate(column.id, 'nullable', !column.nullable)}
          className={`px-1 text-[9px] rounded border ${column.nullable ? 'bg-blue-100 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-400'}`}
          title="Nullable"
        >
          N
        </button>
        <button 
          onClick={() => onUpdate(column.id, 'unique', !column.unique)}
          className={`px-1 text-[9px] rounded border ${column.unique ? 'bg-purple-100 border-purple-200 text-purple-700' : 'border-slate-200 text-slate-400'}`}
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
