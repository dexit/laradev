import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  Connection, 
  Edge, 
  useNodesState, 
  useEdgesState,
  MiniMap,
  ReactFlowProvider
} from 'reactflow';
import { Plus, Download, Wand2, Database, Trash2, Github } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import TableNode from './components/TableNode';
import { CodePreview } from './components/CodePreview';
// FIX: Import TableNode as TNode to avoid name collision with the component and correctly type the initial state.
import { GeneratedCode, TableNode as TNode } from './types';
import { generateLaravelMigrations } from './services/migrationGenerator';
import { generateSchemaFromPrompt } from './services/geminiService';
import { DEFAULT_COLUMNS, COLORS } from './constants';

const nodeTypes = {
  table: TableNode,
};

// Initial data
// FIX: Explicitly type initialNodes to align with the type returned by the AI service and prevent mismatches.
const initialNodes: TNode[] = [
  {
    id: '1',
    type: 'table',
    position: { x: 100, y: 100 },
    data: { 
      name: 'users', 
      color: COLORS[5],
      columns: [
        { id: 'c1', name: 'id', type: 'id', nullable: false, unique: true, isPrimaryKey: true },
        { id: 'c2', name: 'name', type: 'string', nullable: false, unique: false },
        { id: 'c3', name: 'email', type: 'string', nullable: false, unique: true },
        { id: 'c4', name: 'password', type: 'string', nullable: false, unique: false },
      ]
    },
  },
  {
    id: '2',
    type: 'table',
    position: { x: 500, y: 100 },
    data: { 
      name: 'posts', 
      color: COLORS[4],
      columns: [
        { id: 'p1', name: 'id', type: 'id', nullable: false, unique: true, isPrimaryKey: true },
        { id: 'p2', name: 'title', type: 'string', nullable: false, unique: false },
        { id: 'p3', name: 'content', type: 'text', nullable: true, unique: false },
      ]
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'hasMany', type: 'smoothstep', animated: true },
];

function SchemaDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedCode[]>([]);
  
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAIPrompt, setShowAIPrompt] = useState(false);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, label: 'rel' }, eds)), [setEdges]);

  // Listen for custom events from Node components (Architecture choice to avoid passing setters deep)
  useEffect(() => {
    const handleNodeUpdate = (e: CustomEvent) => {
      const { id, data } = e.detail;
      setNodes((nds) => 
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, ...data } };
          }
          return node;
        })
      );
    };

    const handleNodeDelete = (e: CustomEvent) => {
      const { id } = e.detail;
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    window.addEventListener('node-data-update' as any, handleNodeUpdate);
    window.addEventListener('node-delete' as any, handleNodeDelete);

    return () => {
      window.removeEventListener('node-data-update' as any, handleNodeUpdate);
      window.removeEventListener('node-delete' as any, handleNodeDelete);
    };
  }, [setNodes, setEdges]);

  const addTable = () => {
    const id = uuidv4();
    const newNode = {
      id,
      type: 'table',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        name: `table_${nodes.length + 1}`,
        columns: [...DEFAULT_COLUMNS],
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleExport = () => {
    // FIX: Removed @ts-ignore as the `nodes` type is now correctly inferred.
    const codes = generateLaravelMigrations(nodes, edges);
    setGeneratedFiles(codes);
    setIsExportOpen(true);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAILoading(true);
    try {
      const { nodes: newNodes, edges: newEdges } = await generateSchemaFromPrompt(aiPrompt);
      setNodes(newNodes);
      setEdges(newEdges);
      setShowAIPrompt(false);
      setAiPrompt('');
    } catch (error) {
      alert("Failed to generate schema. Please check your API Key and try again.");
    } finally {
      setIsAILoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50">
      {/* Top Navbar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            L
          </div>
          <h1 className="font-bold text-slate-800 text-lg tracking-tight">Laravel Schema <span className="text-slate-400 font-normal">Architect</span></h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAIPrompt(!showAIPrompt)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium transition-colors border border-purple-200"
          >
            <Wand2 size={18} />
            <span className="hidden sm:inline">AI Designer</span>
          </button>
          
          <div className="h-6 w-px bg-slate-200 mx-2"></div>

          <button 
            onClick={addTable}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Table</span>
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium shadow-lg shadow-slate-200 transition-all hover:scale-105"
          >
            <Download size={18} />
            Export Migrations
          </button>
        </div>
      </header>

      {/* AI Prompt Overlay */}
      {showAIPrompt && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] z-50 bg-white p-4 rounded-xl shadow-2xl border border-purple-100 animate-in fade-in zoom-in duration-200">
           <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
             <Wand2 size={16} className="text-purple-500"/> Describe your app
           </h3>
           <textarea 
             className="w-full h-32 p-3 bg-slate-50 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none resize-none text-sm"
             placeholder="e.g. A library management system with books, authors, members and loans..."
             value={aiPrompt}
             onChange={e => setAiPrompt(e.target.value)}
           />
           <div className="flex justify-end gap-2 mt-3">
             <button onClick={() => setShowAIPrompt(false)} className="px-3 py-1.5 text-slate-500 text-sm hover:bg-slate-100 rounded-md">Cancel</button>
             <button 
               onClick={handleAIGenerate}
               disabled={isAILoading}
               className="px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
             >
               {isAILoading ? 'Thinking...' : 'Generate Schema'}
             </button>
           </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-50"
          defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { strokeWidth: 2, stroke: '#94a3b8' } }}
        >
          <Background color="#cbd5e1" gap={20} size={1} />
          <Controls className="!bg-white !border-slate-200 !shadow-lg !rounded-lg !p-1" />
          <MiniMap 
            className="!bg-white !border-slate-200 !shadow-lg !rounded-lg" 
            maskColor="rgba(241, 245, 249, 0.7)"
            // FIX: Provide a fallback color to handle cases where node.data.color is undefined.
            nodeColor={(n) => n.data.color || '#3b82f6'} 
          />
        </ReactFlow>
        
        {/* Helper Text */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-slate-400">
              <Database size={48} className="mx-auto mb-2 opacity-20" />
              <p className="font-medium">Canvas is empty</p>
              <p className="text-sm">Add a table or use AI to start</p>
            </div>
          </div>
        )}
      </div>

      <CodePreview 
        isOpen={isExportOpen} 
        onClose={() => setIsExportOpen(false)} 
        files={generatedFiles} 
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <SchemaDesigner />
    </ReactFlowProvider>
  );
}
