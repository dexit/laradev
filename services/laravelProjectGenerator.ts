import { TableNode, RelationEdge, GeneratedCode, Column } from '../types';

// String utilities for Laravel naming conventions
const singularize = (str: string): string => {
  const lower = str.toLowerCase();
  if (lower.endsWith('ies')) return lower.slice(0, -3) + 'y';
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
};

const pluralize = (str: string): string => {
  const lower = str.toLowerCase();
  if (lower.endsWith('y') && !lower.endsWith('ay') && !lower.endsWith('ey') && !lower.endsWith('oy') && !lower.endsWith('uy')) {
    return lower.slice(0, -1) + 'ies';
  }
  if (!lower.endsWith('s')) return lower + 's';
  return lower;
};

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

export const generateLaravelProject = (nodes: TableNode[], edges: RelationEdge[]): GeneratedCode[] => {
  const files: GeneratedCode[] = [];
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);

  // Parse relationship details from edges
  const parsedRelationships = edges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    // Connected field IDs (from sourceHandle/targetHandle)
    const sourceColId = edge.sourceHandle?.replace('col-', '').replace('-source', '');
    const targetColId = edge.targetHandle?.replace('col-', '').replace('-target', '');

    const sourceCol = sourceNode?.data.columns.find(c => c.id === sourceColId);
    const targetCol = targetNode?.data.columns.find(c => c.id === targetColId);

    // Relationship settings with defaults
    const relationType = edge.data?.relationType || 'hasMany';
    const onDelete = edge.data?.onDelete || 'cascade';
    const sourceColName = sourceCol?.name || 'id';
    const targetColName = targetCol?.name || `${singularize(sourceNode?.data.name || '')}_id`;

    return {
      id: edge.id,
      relationType,
      onDelete,
      sourceNode,
      targetNode,
      sourceColName,
      targetColName,
      label: edge.label || relationType,
    };
  }).filter(r => r.sourceNode && r.targetNode);

  // 1. GENERATE MIGRATIONS
  nodes.forEach((node, index) => {
    const tableName = node.data.name.toLowerCase();
    const className = `Create${toStudly(tableName)}Table`;
    const filename = `database/migrations/${timestamp}_${String(index).padStart(3, '0')}_create_${tableName}_table.php`;

    // Normal column definitions
    const columnLines = node.data.columns.map(col => {
      if (col.type === 'id') return `            $table->id();`;
      
      let line = `            $table->${col.type}('${col.name}')`;
      if (col.nullable) line += `->nullable()`;
      if (col.unique) line += `->unique()`;
      if (col.default !== undefined && col.default !== '') {
        // Enclose numerical strings or values safely, handle booleans
        if (col.type === 'boolean') {
          const val = col.default === 'true' || col.default === '1' ? 'true' : 'false';
          line += `->default(${val})`;
        } else if (!isNaN(Number(col.default))) {
          line += `->default(${col.default})`;
        } else {
          line += `->default('${col.default}')`;
        }
      }
      
      line += `;`;
      return line;
    });

    // Foreign Keys / Constraints defined on this table (as target of relationships)
    const constraints: string[] = [];
    parsedRelationships.forEach(rel => {
      if (rel.targetNode?.id === node.id) {
        // Check if there's already a foreign keys column declared. If not, append the helper constraint line
        const hasColInTable = node.data.columns.some(c => c.name === rel.targetColName);
        
        let constraintLine = ``;
        if (hasColInTable) {
          // Add constraints to an existing column
          constraintLine = `            $table->foreign('${rel.targetColName}')->references('${rel.sourceColName}')->on('${rel.sourceNode?.data.name}')->onDelete('${rel.onDelete}');`;
        } else {
          // Declare the complete foreignId connection inline
          constraintLine = `            $table->foreignId('${rel.targetColName}')->constrained('${rel.sourceNode?.data.name}')->onDelete('${rel.onDelete}');`;
        }
        constraints.push(constraintLine);
      }
    });

    const migrationContent = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Generated via Laravel Schema Architect.
     */
    public function up(): void
    {
        Schema::create('${tableName}', function (Blueprint $table) {
${columnLines.join('\n')}
${constraints.length > 0 ? '\n' + constraints.join('\n') : ''}
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

    files.push({
      filename,
      content: migrationContent,
      type: 'migration'
    });
  });

  // 2. GENERATE MODELS
  nodes.forEach(node => {
    const tableName = node.data.name.toLowerCase();
    const modelName = toStudly(singularize(tableName));
    const filename = `app/Models/${modelName}.php`;

    // Fillable attributes
    const fillableCols = node.data.columns
      .filter(col => col.type !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at')
      .map(col => `'${col.name}'`);

    // Relationships
    const relationMethods: string[] = [];

    // Relationships where this Model is SOURCE
    parsedRelationships.forEach(rel => {
      if (rel.sourceNode?.id === node.id) {
        const destClass = toStudly(singularize(rel.targetNode?.data.name || ''));
        const relationMethodName = rel.relationType === 'hasOne' 
          ? toCamel(singularize(rel.targetNode?.data.name || ''))
          : toCamel(rel.targetNode?.data.name || '');

        let methodBody = ``;
        if (rel.relationType === 'hasOne') {
          methodBody = `        return $this->hasOne(${destClass}::class, '${rel.targetColName}', '${rel.sourceColName}');`;
        } else if (rel.relationType === 'hasMany') {
          methodBody = `        return $this->hasMany(${destClass}::class, '${rel.targetColName}', '${rel.sourceColName}');`;
        } else if (rel.relationType === 'belongsToMany') {
          const pivotName = rel.label || `${singularize(tableName)}_${singularize(rel.targetNode?.data.name || '')}`;
          methodBody = `        return $this->belongsToMany(${destClass}::class, '${pivotName}');`;
        }

        relationMethods.push(`    /**
     * Get the associated ${relationMethodName}.
     */
    public function ${relationMethodName}()
    {
${methodBody}
    }`);
      }
    });

    // Relationships where this Model is TARGET
    parsedRelationships.forEach(rel => {
      if (rel.targetNode?.id === node.id) {
        const parentClass = toStudly(singularize(rel.sourceNode?.data.name || ''));
        const relationMethodName = toCamel(singularize(rel.sourceNode?.data.name || ''));

        let methodBody = ``;
        if (rel.relationType === 'belongsToMany') {
          const pivotName = rel.label || `${singularize(rel.sourceNode?.data.name || '')}_${singularize(tableName)}`;
          methodBody = `        return $this->belongsToMany(${parentClass}::class, '${pivotName}');`;
        } else {
          methodBody = `        return $this->belongsTo(${parentClass}::class, '${rel.targetColName}', '${rel.sourceColName}');`;
        }

        relationMethods.push(`    /**
     * Get the owning ${relationMethodName}.
     */
    public function ${relationMethodName}()
    {
${methodBody}
    }`);
      }
    });

    const modelContent = `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;

class ${modelName} extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = '${tableName}';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        ${fillableCols.join(',\n        ')}
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
${node.data.columns
  .filter(col => col.type === 'json' || col.type === 'boolean' || col.type === 'date' || col.type === 'dateTime')
  .map(col => {
    let cast = 'string';
    if (col.type === 'json') cast = 'array';
    if (col.type === 'boolean') cast = 'boolean';
    if (col.type === 'date') cast = 'date';
    if (col.type === 'dateTime') cast = 'datetime';
    return `        '${col.name}' => '${cast}',`;
  })
  .join('\n')}
    ];
${relationMethods.length > 0 ? '\n' + relationMethods.join('\n\n') : ''}
}`;

    files.push({
      filename,
      content: modelContent,
      type: 'model'
    });
  });

  // 3. GENERATE CONTROLLERS (Resource Controllers)
  nodes.forEach(node => {
    const tableName = node.data.name.toLowerCase();
    const modelName = toStudly(singularize(tableName));
    const controllerName = `${modelName}Controller`;
    const filename = `app/Http/Controllers/${controllerName}.php`;

    // Dynamic validations for store/update
    const validationRules = node.data.columns
      .filter(col => col.type !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at')
      .map(col => {
        const rules = [];
        if (col.nullable) {
          rules.push('nullable');
        } else {
          rules.push('required');
        }

        // Apply rules based on type
        if (col.type === 'string') rules.push('string', 'max:255');
        else if (col.type === 'text') rules.push('string');
        else if (col.type === 'integer' || col.type === 'bigInteger') rules.push('integer');
        else if (col.type === 'boolean') rules.push('boolean');
        else if (col.type === 'decimal' || col.type === 'float') rules.push('numeric');
        else if (col.type === 'date' || col.type === 'dateTime' || col.type === 'timestamp') rules.push('date');
        else if (col.type === 'json') rules.push('array');

        if (col.unique) {
          rules.push(`unique:${tableName},${col.name}`);
        }

        return `            '${col.name}' => '${rules.join('|')}',`;
      });

    const controllerContent = `<?php

namespace App\\Http\\Controllers;

use App\\Models\\${modelName};
use Illuminate\\Http\\Request;

class ${controllerName} extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $records = ${modelName}::latest()->paginate(15);
        return view('${tableName}.index', compact('records'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('${tableName}.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
${validationRules.join('\n')}
        ]);

        ${modelName}::create($validated);

        return redirect()->route('${tableName}.index')
            ->with('success', '${modelName} was created successfully.');
    }

    /**
     * Display the specified resource.
     */
    public function show(${modelName} $${toCamel(modelName)})
    {
        return view('${tableName}.show', compact('${toCamel(modelName)}'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(${modelName} $${toCamel(modelName)})
    {
        return view('${tableName}.edit', compact('${toCamel(modelName)}'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, ${modelName} $${toCamel(modelName)})
    {
        // Adjust unique validation to ignore the current record
        $validated = $request->validate([
${node.data.columns
  .filter(col => col.type !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at')
  .map(col => {
    let rule = col.nullable ? 'nullable' : 'required';
    if (col.type === 'string') rule += '|string|max:255';
    else if (col.type === 'integer') rule += '|integer';
    else if (col.type === 'boolean') rule += '|boolean';
    if (col.unique) {
      rule += `|unique:${tableName},${col.name},'.$${toCamel(modelName)}->id`;
    } else {
      rule += '';
    }
    return `            '${col.name}' => '${rule}',`;
  })
  .join('\n')}
        ]);

        $${toCamel(modelName)}->update($validated);

        return redirect()->route('${tableName}.index')
            ->with('success', '${modelName} was updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(${modelName} $${toCamel(modelName)})
    {
        $${toCamel(modelName)}->delete();

        return redirect()->route('${tableName}.index')
            ->with('success', '${modelName} was deleted successfully.');
    }
}`;

    files.push({
      filename,
      content: controllerContent,
      type: 'controller' as any
    });
  });

  // 4. GENERATE FACTORIES
  nodes.forEach(node => {
    const tableName = node.data.name.toLowerCase();
    const modelName = toStudly(singularize(tableName));
    const filename = `database/factories/${modelName}Factory.php`;

    const fakerMappings = node.data.columns
      .filter(col => col.type !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at')
      .map(col => {
        let fakerVal = ``;
        const nameLower = col.name.toLowerCase();

        // Standard name-based faker assignments
        if (nameLower.includes('name')) fakerVal = `$this->faker->name()`;
        else if (nameLower.includes('email')) fakerVal = `$this->faker->unique()->safeEmail()`;
        else if (nameLower.includes('password')) fakerVal = `bcrypt('password')`;
        else if (nameLower.includes('phone') || nameLower.includes('tel')) fakerVal = `$this->faker->phoneNumber()`;
        else if (nameLower.includes('title')) fakerVal = `$this->faker->sentence(4)`;
        else if (nameLower.includes('description') || nameLower.includes('content') || nameLower.includes('body')) fakerVal = `$this->faker->paragraph()`;
        else if (nameLower.includes('address')) fakerVal = `$this->faker->address()`;
        else if (nameLower.includes('slug')) fakerVal = `$this->faker->slug()`;
        else if (nameLower.includes('price')) fakerVal = `$this->faker->randomFloat(2, 5, 500)`;
        else {
          // Type fallback faker functions
          if (col.type === 'string') fakerVal = `$this->faker->word()`;
          else if (col.type === 'text') fakerVal = `$this->faker->text()`;
          else if (col.type === 'integer' || col.type === 'bigInteger') fakerVal = `$this->faker->randomNumber()`;
          else if (col.type === 'boolean') fakerVal = `$this->faker->boolean()`;
          else if (col.type === 'decimal' || col.type === 'float') fakerVal = `$this->faker->randomFloat(2, 10, 100)`;
          else if (col.type === 'date') fakerVal = `$this->faker->date()`;
          else if (col.type === 'dateTime' || col.type === 'timestamp') fakerVal = `$this->faker->dateTime()`;
          else if (col.type === 'json') fakerVal = `json_encode(['key' => 'value'])`;
          else if (col.type === 'foreignId') {
            // Find related table singular studly
            const rel = parsedRelationships.find(r => r.targetNode?.id === node.id && r.targetColName === col.name);
            if (rel) {
              const relModel = toStudly(singularize(rel.sourceNode?.data.name || ''));
              fakerVal = `\\\\App\\\\Models\\\\${relModel}::factory()`;
            } else {
              fakerVal = `1`;
            }
          }
        }

        return `            '${col.name}' => ${fakerVal},`;
      });

    const factoryContent = `<?php

namespace Database\\Factories;

use App\\Models\\${modelName};
use Illuminate\\Database\\Eloquent\\Factories\\Factory;

class ${modelName}Factory extends Factory
{
    protected $model = ${modelName}::class;

    /**
     * Define the model's default state.
     */
    public function definition(): array
    {
        return [
${fakerMappings.join('\n')}
        ];
    }
}`;

    files.push({
      filename,
      content: factoryContent,
      type: 'factory' as any
    });
  });

  // 5. GENERATE SEEDERS
  nodes.forEach(node => {
    const tableName = node.data.name.toLowerCase();
    const modelName = toStudly(singularize(tableName));
    const filename = `database/seeders/${modelName}Seeder.php`;

    const seederContent = `<?php

namespace Database\\Seeders;

use App\\Models\\${modelName};
use Illuminate\\Database\\Seeder;

class ${modelName}Seeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Seed 10 records using the factory
        ${modelName}::factory()->count(10)->create();
    }
}`;

    files.push({
      filename,
      content: seederContent,
      type: 'seeder' as any
    });
  });

  // DatabaseSeeder file
  const seederCalls = nodes.map(node => `            ${toStudly(singularize(node.data.name))}Seeder::class,`);
  const mainSeederContent = `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
${seederCalls.join('\n')}
        ]);
    }
}`;
  files.push({
    filename: 'database/seeders/DatabaseSeeder.php',
    content: mainSeederContent,
    type: 'seeder' as any
  });

  // 6. GENERATE BLADE VIEWS (Index and Form templates)
  nodes.forEach(node => {
    const tableName = node.data.name.toLowerCase();
    const modelName = toStudly(singularize(tableName));
    const modelCamel = toCamel(modelName);

    // Dynamic inputs in views
    const formFields = node.data.columns
      .filter(col => col.type !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at')
      .map(col => {
        let inputTypeHtml = ``;
        if (col.type === 'text') {
          inputTypeHtml = `<textarea id="${col.name}" name="${col.name}" rows="3" class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md">{{ old('${col.name}', $${modelCamel}->${col.name} ?? '') }}</textarea>`;
        } else if (col.type === 'boolean') {
          inputTypeHtml = `
            <input id="${col.name}" name="${col.name}" type="checkbox" value="1" {{ old('${col.name}', $${modelCamel}->${col.name} ?? false) ? 'checked' : '' }} class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded">
            <label for="${col.name}" class="ml-2 block text-sm text-gray-900">Active status (or value)</label>`;
        } else if (col.type === 'date') {
          inputTypeHtml = `<input type="date" name="${col.name}" id="${col.name}" value="{{ old('${col.name}', $${modelCamel}->${col.name} ?? '') }}" class="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md">`;
        } else if (col.type === 'dateTime') {
          inputTypeHtml = `<input type="datetime-local" name="${col.name}" id="${col.name}" value="{{ old('${col.name}', $${modelCamel}->${col.name} ? date('Y-m-d\\TH:i', strtotime($${modelCamel}->${col.name})) : '') }}" class="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md">`;
        } else {
          inputTypeHtml = `<input type="text" name="${col.name}" id="${col.name}" value="{{ old('${col.name}', $${modelCamel}->${col.name} ?? '') }}" class="focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border-gray-300 rounded-md">`;
        }

        return `
    <div class="col-span-6 sm:col-span-4">
        <label for="${col.name}" class="block text-sm font-medium text-gray-700">${toStudly(col.name)}</label>
        ${inputTypeHtml}
        @error('${col.name}')
            <span class="text-sm text-red-500 mt-1 block">{{ $message }}</span>
        @enderror
    </div>`;
      });

    // Generate Layout / Index view
    const indexContent = `@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-6">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">${toStudly(tableName)} Suite</h1>
        <a href="{{ route('${tableName}.create') }}" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium sm:text-sm">
            Add ${modelName}
        </a>
    </div>

    @if(session('success'))
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            {{ session('success') }}
        </div>
    @endif

    <div class="flex flex-col">
        <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                <div class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                ${node.data.columns.map(col => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col.name}</th>`).join('\n                                ')}
                                <th class="relative px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            @foreach($records as $row)
                                <tr>
                                    ${node.data.columns.map(col => `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ $row->${col.name} }}</td>`).join('\n                                    ')}
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
                                        <a href="{{ route('${tableName}.edit', $row->id) }}" class="text-indigo-600 hover:text-indigo-900">Edit</a>
                                        <form action="{{ route('${tableName}.destroy', $row->id) }}" method="POST" onsubmit="return confirm('Are you sure?')">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="text-red-600 hover:text-red-900">Delete</button>
                                        </form>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <div class="mt-4">
        {{ $records->links() }}
    </div>
</div>
@endsection`;

    const createContent = `@extends('layouts.app')

@section('content')
<div class="max-w-3xl mx-auto px-4 py-6">
    <div class="mb-6">
        <a href="{{ route('${tableName}.index') }}" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back to List</a>
        <h1 class="text-2xl font-bold text-gray-800 mt-2">Create New ${modelName}</h1>
    </div>

    <form action="{{ route('${tableName}.store') }}" method="POST">
        @csrf
        <div class="shadow sm:rounded-md sm:overflow-hidden">
            <div class="px-4 py-5 bg-white space-y-6 sm:p-6">
                <div class="grid grid-cols-6 gap-6">
                    ${formFields.join('\n')}
                </div>
            </div>
            <div class="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    Save Record
                </button>
            </div>
        </div>
    </form>
</div>
@endsection`;

    files.push({
      filename: `resources/views/${tableName}/index.blade.php`,
      content: indexContent,
      type: 'view' as any
    });

    files.push({
      filename: `resources/views/${tableName}/create.blade.php`,
      content: createContent,
      type: 'view' as any
    });
  });

  // 7. GENERATE ROUTES
  const routeImports = nodes.map(node => `use App\\Http\\Controllers\\${toStudly(singularize(node.data.name))}Controller;`);
  const routeDeclarations = nodes.map(node => `Route::resource('${node.data.name.toLowerCase()}', ${toStudly(singularize(node.data.name))}Controller::class);`);
  const routesContent = `<?php

use Illuminate\\Support\\Facades\\Route;
${routeImports.join('\n')}

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Generated via Laravel Schema Architect.
|
*/

Route::get('/', function () {
    return view('welcome');
});

// Admin-level resource dashboards
Route::middleware(['web'])->group(function () {
    ${routeDeclarations.join('\n    ')}
});`;

  files.push({
    filename: 'routes/web.php',
    content: routesContent,
    type: 'route' as any
  });

  // 8. GENERATE CUSTOM ARTISAN COMMAND
  const commandContent = `<?php

namespace App\\Console\\Commands;

use Illuminate\\Console\\Command;
use Illuminate\\Support\\Facades\\Artisan;

class SetupAppArchitecture extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:setup-architecture';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automate system setup: run generated migrations and populate standard factories';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting database clean and architect build...');
        
        if ($this->confirm('This will wipe your current schema. Do you want to proceed?', true)) {
            $this->call('migrate:fresh');
            $this->info('Migrations compiled and injected.');

            $this->info('Seeding realistic model seeders...');
            $this->call('db:seed');
            $this->info('Success! Database hydrated with factory data.');
        }

        return Command::SUCCESS;
    }
}`;

  files.push({
    filename: 'app/Console/Commands/SetupAppArchitecture.php',
    content: commandContent,
    type: 'command' as any
  });

  // 9. GENERATE TYPESCRIPT TYPES
  const tsInterfaces = nodes.map(node => {
    const tableName = node.data.name.toLowerCase();
    const modelName = toStudly(singularize(tableName));
    const properties = node.data.columns.map(col => {
      let tsType = 'string';
      if (col.type === 'integer' || col.type === 'bigInteger' || col.type === 'decimal' || col.type === 'float') tsType = 'number';
      else if (col.type === 'boolean') tsType = 'boolean';
      else if (col.type === 'json') tsType = 'any[] | Record<string, any>';
      
      return `  ${col.name}${col.nullable ? '?' : ''}: ${tsType};`;
    });

    return `export interface ${modelName} {\n${properties.join('\n')}\n}`;
  });

  files.push({
    filename: 'resources/js/types/models.ts',
    content: `/**\n * Auto-generated Model definitions matching Laravel models.\n */\n\n${tsInterfaces.join('\n\n')}`,
    type: 'api-types' as any
  });

  return files;
};
