import { TableNode, RelationEdge, GeneratedCode, Column } from '../types';

export const generateLaravelMigrations = (nodes: TableNode[], edges: RelationEdge[]): GeneratedCode[] => {
  const codes: GeneratedCode[] = [];
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);

  nodes.forEach((node, index) => {
    const tableName = node.data.name;
    const className = `Create${tableName.charAt(0).toUpperCase() + tableName.slice(1)}Table`;
    const filename = `${timestamp}_${String(index).padStart(3, '0')}_create_${tableName}_table.php`;

    // Calculate foreign keys coming INTO this table
    const foreignKeys = edges
      .filter(edge => edge.target === node.id)
      .map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) return '';
        // Assuming typical Laravel convention: source_id
        const sourceNameSingular = sourceNode.data.name.endsWith('s') 
          ? sourceNode.data.name.slice(0, -1) 
          : sourceNode.data.name;
        
        return `            $table->foreignId('${sourceNameSingular}_id')->constrained('${sourceNode.data.name}')->onDelete('cascade');`;
      });

    const columnDefinitions = node.data.columns.map(col => generateColumnLine(col)).join('\n');

    const content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${tableName}', function (Blueprint $table) {
${columnDefinitions}
${foreignKeys.length > 0 ? '\n' + foreignKeys.join('\n') : ''}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${tableName}');
    }
};`;

    codes.push({
      filename,
      content,
      type: 'migration'
    });
  });

  return codes;
};

const generateColumnLine = (col: Column): string => {
  if (col.type === 'id') return `            $table->id();`;
  
  let line = `            $table->${col.type}('${col.name}')`;
  
  if (col.nullable) line += `->nullable()`;
  if (col.unique) line += `->unique()`;
  if (col.default) line += `->default('${col.default}')`; // Simple default handling
  
  line += `;`;
  return line;
};
