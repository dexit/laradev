import React, { useState } from 'react';
import { X, Copy, Download, Code } from 'lucide-react';
import JSZip from 'jszip';
import { GeneratedCode } from '../types';

interface Props {
  files: GeneratedCode[];
  isOpen: boolean;
  onClose: () => void;
}

export const CodePreview: React.FC<Props> = ({ files, isOpen, onClose }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const handleDownloadZip = async () => {
    if (files.length === 0) return;

    const zip = new JSZip();

    files.forEach(file => {
      zip.file(file.filename, file.content);
    });

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `laravel-migrations-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Failed to generate zip file:", error);
      alert("There was an error creating the zip file.");
    }
  };

  if (!isOpen) return null;

  const activeFile = files[activeFileIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Code size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Generated Migrations</h2>
              <p className="text-xs text-slate-500">Ready for artisan migrate</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Files List */}
          <div className="w-1/3 bg-slate-50 border-r border-slate-200 overflow-y-auto">
            {files.map((file, idx) => (
              <button
                key={file.filename}
                onClick={() => setActiveFileIndex(idx)}
                className={`w-full text-left px-4 py-3 text-xs font-mono border-b border-slate-100 transition-colors ${
                  activeFileIndex === idx 
                    ? 'bg-white border-l-4 border-l-blue-500 text-blue-700 font-medium shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {file.filename}
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="w-2/3 flex flex-col bg-[#1e293b]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#0f172a] text-slate-400 text-xs border-b border-slate-700">
              <span className="font-mono">{activeFile?.filename}</span>
              <div className="flex gap-2">
                 <button 
                  onClick={() => activeFile && navigator.clipboard.writeText(activeFile.content)}
                  className="flex items-center gap-1 hover:text-white"
                 >
                   <Copy size={12} /> Copy
                 </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="font-mono text-xs text-blue-100 leading-relaxed">
                <code>{activeFile?.content}</code>
              </pre>
            </div>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg">
                Close
            </button>
            <button 
              onClick={handleDownloadZip}
              className="px-4 py-2 bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-200 flex items-center gap-2"
            >
                <Download size={16} /> Download All (.zip)
            </button>
        </div>

      </div>
    </div>
  );
};