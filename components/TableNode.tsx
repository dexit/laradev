import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
// FIX: Import LaravelColumnType to correctly type new columns.
import { TableData, LaravelColumnType } from '../types';
import { ColumnRow } from './ColumnRow';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { COLORS } from '../constants';

const TableNode = ({ id, data }: NodeProps<TableData>) => {
  
  // Handlers would typically be passed down via context or custom props, 
  // but React Flow data object is mutable. We can also use a store pattern.
  // For simplicity in this demo, we assume data holds methods or we dispatch globally.
  // We will emit events via the `data.onUpdate` callback pattern if provided, 
  // OR we rely on the parent component to force updates.
  // For a strictly controlled component, we should use the React Flow `useReactFlow` hook to update node data.
  
  // Since we can't easily pass functions into `data` during serialization/AI gen, 
  // we'll dispatch CustomEvents that the main App listens to, strictly for this demo architecture.
  
  const dispatchUpdate = (newData: Partial<TableData>) => {
    const event = new CustomEvent('node-data-update', {
      detail: { id, data: newData }
    });
    window.dispatchEvent(event);
  };

  const dispatchDelete = () => {
    const event = new CustomEvent('node-delete', { detail: { id } });
    window.dispatchEvent(event);
  }

  const addColumn = () => {
    const newCol = { 
      id: uuidv4(), 
      name: 'new_column', 
      // FIX: Cast 'string' to LaravelColumnType to match the Column interface.
      type: 'string' as LaravelColumnType, 
      nullable: false, 
      unique: false 
    };
    dispatchUpdate({
      // FIX: Removed @ts-ignore as the type is now correct.
      columns: [...data.columns, newCol]
    });
  };

  const updateColumn = (colId: string, field: string, value: any) => {
    const newCols = data.columns.map(c => 
      c.id === colId ? { ...c, [field]: value } : c
    );
    dispatchUpdate({ columns: newCols });
  };

  const removeColumn = (colId: string) => {
    dispatchUpdate({ columns: data.columns.filter(c => c.id !== colId) });
  };

  const changeColor = (color: string) => {
    dispatchUpdate({ color });
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-[280px] overflow-hidden text-sm flex flex-col">
      {/* Handles for connections */}
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-3 !h-3 -ml-1.5" />
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-3 !h-3 -mr-1.5" />

      {/* Header */}
      <div 
        className="px-3 py-2 flex items-center justify-between handle relative" 
        style={{ backgroundColor: data.color || '#3b82f6' }}
      >
        <div className="flex items-center gap-2 flex-1">
          <GripVertical size={14} className="text-white/50 cursor-grab active:cursor-grabbing" />
          <input 
            className="nodrag bg-transparent text-white font-bold placeholder-white/70 outline-none w-full"
            value={data.name}
            onChange={(e) => dispatchUpdate({ name: e.target.value })}
            placeholder="Table Name"
          />
        </div>
        <div className="flex items-center gap-1">
          {/* Color Picker (Hidden till hover usually, but let's put a small dot) */}
          <div className="group relative">
             <div className="w-3 h-3 rounded-full bg-white/30 cursor-pointer hover:bg-white border border-white/40"></div>
             <div className="absolute right-0 top-full mt-1 hidden group-hover:flex gap-1 p-1 bg-white shadow-lg rounded-md z-50 w-32 flex-wrap">
                {COLORS.map(c => (
                  <div 
                    key={c} 
                    className="w-4 h-4 rounded-full cursor-pointer hover:scale-110" 
                    style={{backgroundColor: c}}
                    onClick={() => changeColor(c)}
                  />
                ))}
             </div>
          </div>
          <button onClick={dispatchDelete} className="text-white/70 hover:text-white">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Columns List */}
      <div className="flex flex-col bg-white min-h-[50px] divide-y divide-slate-50">
        {data.columns.map((col) => (
          <ColumnRow 
            key={col.id} 
            column={col} 
            onUpdate={updateColumn} 
            onRemove={removeColumn} 
          />
        ))}
      </div>

      {/* Footer */}
      <button 
        onClick={addColumn}
        className="flex items-center justify-center gap-1 py-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors border-t border-slate-100 text-xs font-medium"
      >
        <Plus size={12} /> Add Column
      </button>
    </div>
  );
};

export default memo(TableNode);