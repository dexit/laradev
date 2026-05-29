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
import { 
  Plus, 
  Download, 
  Wand2, 
  Database, 
  Trash2, 
  Link2, 
  HelpCircle, 
  Settings, 
  X, 
  AlertTriangle,
  Code2,
  BookOpen,
  CheckCircle2,
  Layers,
  Fingerprint
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import TableNode from './components/TableNode';
import { CodePreview } from './components/CodePreview';
import { GeneratedCode, TableNode as TNode } from './types';
import { generateLaravelProject } from './services/laravelProjectGenerator';
import { generateSchemaFromPrompt } from './services/geminiService';
import { DEFAULT_COLUMNS, COLORS } from './constants';

const nodeTypes = {
  table: TableNode,
};

// Studly helper for descriptive advice
const toStudly = (str: string): string => {
  return str
    .split(/_|-|\s/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

const toCamel = (str: string): string => {
  const studly = toStudly(str);
  return studly.charAt(0).toLowerCase() + studly.slice(1);
};

// Initial data
const initialNodes: TNode[] = [
  {
    id: '1',
    type: 'table',
    position: { x: 100, y: 150 },
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
    position: { x: 600, y: 150 },
    data: { 
      name: 'posts', 
      color: COLORS[4],
      columns: [
        { id: 'p1', name: 'id', type: 'id', nullable: false, unique: true, isPrimaryKey: true },
        { id: 'p2', name: 'user_id', type: 'foreignId', nullable: false, unique: false },
        { id: 'p3', name: 'title', type: 'string', nullable: false, unique: false },
        { id: 'p4', name: 'content', type: 'text', nullable: true, unique: false },
      ]
    },
  },
];

const initialEdges: Edge[] = [
  { 
    id: 'e1-2', 
    source: '1', 
    target: '2', 
    sourceHandle: 'col-c1-source',
    targetHandle: 'col-p2-target',
    label: 'hasMany (cascade)', 
    type: 'smoothstep', 
    animated: true,
    data: {
      relationType: 'hasMany',
      onDelete: 'cascade',
      sourceColName: 'id',
      targetColName: 'user_id'
    }
  },
];

function SchemaDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedCode[]>([]);
  
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAIPrompt, setShowAIPrompt] = useState(false);

  // Connection Edges Modal State
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [edgeRelationType, setEdgeRelationType] = useState('hasMany');
  const [edgeOnDelete, setEdgeOnDelete] = useState('cascade');
  const [edgeSourceCol, setEdgeSourceCol] = useState('id');
  const [edgeTargetCol, setEdgeTargetCol] = useState('id');
  const [edgePivotTable, setEdgePivotTable] = useState('');

  // Handle new connections with column awareness
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => {
      const sourceColId = params.sourceHandle ? params.sourceHandle.replace('col-', '').replace('-source', '') : 'id';
      const targetColId = params.targetHandle ? params.targetHandle.replace('col-', '').replace('-target', '') : 'id';

      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      const sourceCol = sourceNode?.data.columns.find(c => c.id === sourceColId);
      const targetCol = targetNode?.data.columns.find(c => c.id === targetColId);

      const sourceColName = sourceCol?.name || 'id';
      const targetColName = targetCol?.name || 'id';

      const relationType = targetColName.endsWith('_id') ? 'hasMany' : 'hasOne';

      return addEdge({ 
        ...params, 
        type: 'smoothstep', 
        animated: true, 
        label: `${relationType} (cascade)`,
        data: {
          relationType,
          onDelete: 'cascade',
          sourceColName,
          targetColName,
          pivotTable: ''
        } 
      }, eds);
    });
  }, [setEdges, nodes]);

  // Load custom states when selected edge changes
  const sourceNode = selectedEdge ? nodes.find(n => n.id === selectedEdge.source) : null;
  const targetNode = selectedEdge ? nodes.find(n => n.id === selectedEdge.target) : null;

  useEffect(() => {
    if (selectedEdge) {
      setEdgeRelationType(selectedEdge.data?.relationType || 'hasMany');
      setEdgeOnDelete(selectedEdge.data?.onDelete || 'cascade');
      setEdgeSourceCol(selectedEdge.data?.sourceColName || 'id');
      setEdgeTargetCol(selectedEdge.data?.targetColName || 'id');
      setEdgePivotTable(selectedEdge.data?.pivotTable || '');
    }
  }, [selectedEdge]);

  // Save updated edge data
  const handleUpdateEdge = () => {
    if (!selectedEdge) return;

    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === selectedEdge.id) {
          return {
            ...e,
            label: `${edgeRelationType} (${edgeOnDelete})`,
            data: {
              ...e.data,
              relationType: edgeRelationType,
              onDelete: edgeOnDelete,
              sourceColName: edgeSourceCol,
              targetColName: edgeTargetCol,
              pivotTable: edgePivotTable
            },
          };
        }
        return e;
      })
    );
    setIsEdgeModalOpen(false);
    setSelectedEdge(null);
  };

  // Delete relationship
  const handleDeleteEdge = () => {
    if (!selectedEdge) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    setIsEdgeModalOpen(false);
    setSelectedEdge(null);
  };

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
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        name: `table_${nodes.length + 1}`,
        columns: [...DEFAULT_COLUMNS],
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleExport = () => {
    const codes = generateLaravelProject(nodes, edges);
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

  // Advice Generator Content
  const getAdvice = () => {
    if (!sourceNode || !targetNode) return null;
    const sourceTableName = sourceNode.data.name;
    const targetTableName = targetNode.data.name;
    const sourceSingular = sourceTableName.endsWith('s') ? sourceTableName.slice(0, -1) : sourceTableName;
    const targetSingular = targetTableName.endsWith('s') ? targetTableName.slice(0, -1) : targetTableName;

    switch (edgeRelationType) {
      case 'hasOne':
        return {
          title: "One-to-One Relation (hasOne)",
          description: `Connects ${toStudly(sourceTableName)} directly to a single ${toStudly(targetTableName)}. Best for splitting up large tables into smaller profile components.`,
          laravelCode: `// app/Models/${toStudly(sourceSingular)}.php\npublic function ${toCamel(targetSingular)}()\n{\n    return $this->hasOne(${toStudly(targetSingular)}::class, '${edgeTargetCol}', '${edgeSourceCol}');\n}`,
          convention: `Laravel expects a foreign key column named "${sourceSingular}_id" to reside in the target table "${targetTableName}".`
        };
      case 'hasMany':
        return {
          title: "One-to-Many Relation (hasMany)",
          description: `The standard parent-child format. One ${toStudly(sourceSingular)} owns many related records of ${toStudly(targetTableName)} (e.g. users having multiple posts).`,
          laravelCode: `// app/Models/${toStudly(sourceSingular)}.php\npublic function ${toCamel(targetTableName)}()\n{\n    return $this->hasMany(${toStudly(targetSingular)}::class, '${edgeTargetCol}', '${edgeSourceCol}');\n}`,
          convention: `Laravel strongly expects a foreign key column named "${sourceSingular}_id" to reside inside the child table "${targetTableName}".`
        };
      case 'belongsTo':
        return {
          title: "Belongs-To Inverse Relation (belongsTo)",
          description: `The inverse connection. Denotes that our child model ${toStudly(targetSingular)} holds the foreign identifier referencing the parent model ${toStudly(sourceSingular)}.`,
          laravelCode: `// app/Models/${toStudly(targetSingular)}.php\npublic function ${toCamel(sourceSingular)}()\n{\n    return $this->belongsTo(${toStudly(sourceSingular)}::class, '${edgeTargetCol}', '${edgeSourceCol}');\n}`,
          convention: `Requires the key "${edgeTargetCol}" inside table "${targetTableName}" to match "${edgeSourceCol}" inside parent table "${sourceTableName}".`
        };
      case 'belongsToMany':
        const alphabeticalPivot = [sourceSingular, targetSingular].sort().join('_');
        const customPivotName = edgePivotTable || alphabeticalPivot;
        return {
          title: "Many-to-Many Relation (belongsToMany)",
          description: `Defines a shared joint lookup between both datasets. Requires an intermediate pivot table to map multiple relationships.`,
          laravelCode: `// app/Models/${toStudly(sourceSingular)}.php\npublic function ${toCamel(targetTableName)}()\n{\n    return $this->belongsToMany(${toStudly(targetSingular)}::class, '${customPivotName}');\n}`,
          convention: `Laravel expects a joint database table named "${customPivotName}" containing foreign key fields matching both singular table names.`
        };
      default:
        return null;
    }
  };

  const adviceContent = getAdvice();

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50">
      {/* Top Navbar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-505 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            L
          </div>
          <h1 className="font-bold text-slate-800 text-lg tracking-tight">Laravel Schema <span className="text-slate-400 font-normal">Architect Expert</span></h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAIPrompt(!showAIPrompt)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium transition-colors border border-purple-200 text-sm"
          >
            <Wand2 size={16} />
            <span>AI Designer</span>
          </button>
          
          <div className="h-5 w-px bg-slate-200 mx-1"></div>

          <button 
            onClick={addTable}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors text-sm"
          >
            <Plus size={16} />
            <span>Add Table</span>
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md transition-all text-sm"
          >
            <Download size={16} />
            Export Laravel Project
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
             placeholder="e.g. A blog platform where users have posts, posts have comments and tags..."
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

      {/* Relationship details editor modal */}
      {isEdgeModalOpen && selectedEdge && sourceNode && targetNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                  <Link2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Configure Relationship Bounds</h3>
                  <p className="text-xs text-slate-500">Define cardinalities & constraint mechanics</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsEdgeModalOpen(false); setSelectedEdge(null); }}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Table labels list */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700">
                <div>
                  <span className="text-slate-400 block uppercase tracking-wider font-semibold mb-0.5">Parent Table</span>
                  <span className="font-bold text-slate-800 font-mono text-sm">{sourceNode.data.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase tracking-wider font-semibold mb-0.5">Child Table</span>
                  <span className="font-bold text-slate-800 font-mono text-sm">{targetNode.data.name}</span>
                </div>
              </div>

              {/* Connected Fields Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Local Priming Key (Source)</label>
                  <select
                    className="w-full p-2 bg-white text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-slate-700"
                    value={edgeSourceCol}
                    onChange={(e) => setEdgeSourceCol(e.target.value)}
                  >
                    {sourceNode.data.columns.map(col => (
                      <option key={col.id} value={col.name}>{col.name} ({col.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Foreign Key Column (Target)</label>
                  <select
                    className="w-full p-2 bg-white text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-slate-700"
                    value={edgeTargetCol}
                    onChange={(e) => setEdgeTargetCol(e.target.value)}
                  >
                    {targetNode.data.columns.map(col => (
                      <option key={col.id} value={col.name}>{col.name} ({col.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Relationship Type & Action on Delete */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Cardinality Relationship Type</label>
                  <select
                    className="w-full p-2 bg-white text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-slate-700"
                    value={edgeRelationType}
                    onChange={(e) => setEdgeRelationType(e.target.value)}
                  >
                    <option value="hasMany">One-To-Many (hasMany)</option>
                    <option value="hasOne">One-To-One (hasOne)</option>
                    <option value="belongsTo">Belongs-To Inverse (belongsTo)</option>
                    <option value="belongsToMany">Many-To-Many (belongsToMany)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">On Delete Blueprint Action</label>
                  <select
                    className="w-full p-2 bg-white text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-slate-700"
                    value={edgeOnDelete}
                    onChange={(e) => setEdgeOnDelete(e.target.value)}
                  >
                    <option value="cascade">cascadeOnDelete()</option>
                    <option value="set null">nullOnDelete()</option>
                    <option value="restrict">restrictOnDelete()</option>
                    <option value="no action">No Action</option>
                  </select>
                </div>
              </div>

              {/* Pivot fields if belongsToMany */}
              {edgeRelationType === 'belongsToMany' && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Custom Pivot Table Name (Optional)</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-white text-xs border border-slate-200 rounded font-mono outline-none text-slate-700"
                    placeholder={`e.g. ${[sourceNode.data.name.slice(0, -1), targetNode.data.name.slice(0, -1)].sort().join('_')}`}
                    value={edgePivotTable}
                    onChange={(e) => setEdgePivotTable(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Leave empty to auto-compute alphabetized singular forms in accordance with standard Laravel style conventions.</span>
                </div>
              )}

              {/* Advice Help Box */}
              {adviceContent && (
                <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 flex gap-3 text-xs leading-relaxed text-slate-600">
                  <div className="p-1 text-indigo-500 shrink-0">
                    <BookOpen size={16} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-indigo-900">{adviceContent.title}</h4>
                    <p>{adviceContent.description}</p>
                    <p className="text-indigo-700 font-medium font-mono">{adviceContent.convention}</p>
                    <div className="pt-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block mb-1">Generated Eloquent Method</span>
                      <pre className="p-2.5 bg-slate-900 text-slate-200 rounded-md font-mono text-[10px] overflow-x-auto leading-normal">
                        <code>{adviceContent.laravelCode}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleDeleteEdge}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Remove Connection
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setIsEdgeModalOpen(false); setSelectedEdge(null); }}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateEdge}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-100 transition-colors"
                >
                  Apply Relationship
                </button>
              </div>
            </div>
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
          onEdgeClick={useCallback((_event: React.MouseEvent, edge: Edge) => {
            setSelectedEdge(edge);
            setIsEdgeModalOpen(true);
          }, [])}
          fitView
          className="bg-slate-50"
          defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { strokeWidth: 2, stroke: '#94a3b8' } }}
        >
          <Background color="#cbd5e1" gap={20} size={1} />
          <Controls className="!bg-white !border-slate-200 !shadow-lg !rounded-lg !p-1" />
          <MiniMap 
            className="!bg-white !border-slate-200 !shadow-lg !rounded-lg" 
            maskColor="rgba(241, 245, 249, 0.7)"
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

        {/* Floating guidance overlay */}
        <div className="absolute bottom-4 left-4 p-3 bg-white/95 backdrop-blur-xs rounded-lg border border-slate-200/80 shadow-md max-w-xs z-10 pointer-events-none">
          <div className="flex items-start gap-2 text-xs">
            <HelpCircle size={14} className="text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block">Field-to-Field Connections</span>
              <p className="text-slate-500 text-[11px] mt-0.5">Hover on column rows to reveal specific circles, then line up source columns to foreign keys directly! Click edge lines to edit constraints.</p>
            </div>
          </div>
        </div>
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
