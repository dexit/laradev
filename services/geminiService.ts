import { GoogleGenAI, Type } from "@google/genai";
import { TableNode, RelationEdge } from "../types";
import { v4 as uuidv4 } from 'uuid';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSchemaFromPrompt = async (prompt: string): Promise<{ nodes: TableNode[], edges: RelationEdge[] }> => {
  try {
    const ai = getClient();
    
    // We request a structured JSON response
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a database schema for a Laravel application based on this description: "${prompt}".
      
      Return a JSON object with:
      1. 'tables': Array of objects with 'name' (string) and 'columns' (array of objects with 'name', 'type', 'nullable', 'unique').
         - Supported types: string, integer, text, boolean, decimal, date, datetime, timestamp, json, foreignId.
         - Ensure 'id' and timestamps are NOT included in the list, I will add them automatically.
      2. 'relationships': Array of objects with 'sourceTable', 'targetTable', 'type' (hasOne, hasMany, belongsToMany).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  columns: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING },
                        nullable: { type: Type.BOOLEAN },
                        unique: { type: Type.BOOLEAN }
                      }
                    }
                  }
                }
              }
            },
            relationships: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sourceTable: { type: Type.STRING },
                  targetTable: { type: Type.STRING },
                  type: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text);
    
    const nodes: TableNode[] = [];
    const edges: RelationEdge[] = [];
    const tableIdMap: Record<string, string> = {};

    // Generate Nodes
    let xOffset = 0;
    let yOffset = 0;
    const spacingX = 350;
    const spacingY = 0; // Simple horizontal layout for now, or grid

    data.tables.forEach((table: any, index: number) => {
      const id = uuidv4();
      tableIdMap[table.name] = id;
      
      // Basic Grid Layout Logic
      const col = index % 3;
      const row = Math.floor(index / 3);

      nodes.push({
        id,
        type: 'table',
        position: { x: col * 400 + 50, y: row * 400 + 50 },
        data: {
          name: table.name.toLowerCase(),
          columns: [
            { id: uuidv4(), name: 'id', type: 'id', nullable: false, unique: true, isPrimaryKey: true },
            ...table.columns.map((c: any) => ({
              id: uuidv4(),
              name: c.name,
              type: c.type || 'string',
              nullable: !!c.nullable,
              unique: !!c.unique
            })),
            { id: uuidv4(), name: 'created_at', type: 'timestamp', nullable: true, unique: false },
            { id: uuidv4(), name: 'updated_at', type: 'timestamp', nullable: true, unique: false },
          ],
          color: '#3b82f6' // Default Blue
        }
      });
    });

    // Generate Edges
    data.relationships.forEach((rel: any) => {
      const sourceId = tableIdMap[rel.sourceTable];
      const targetId = tableIdMap[rel.targetTable];

      if (sourceId && targetId) {
        edges.push({
          id: `e-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep',
          animated: true,
          label: rel.type
        });
      }
    });

    return { nodes, edges };

  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
