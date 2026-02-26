import {
  Table,
  Filter,
  Layers,
  ArrowUpDown,
  Columns3,
  Code2,
  BarChart3,
  Calculator,
  FlipVertical2,
  FileCode,
} from 'lucide-react';
import { nodeTypeInfos } from '@/components/nodes';
import { useCanvasStore } from '@/stores/canvasStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

const iconMap: Record<string, React.ReactNode> = {
  table: <Table size={16} />,
  filter: <Filter size={16} />,
  layers: <Layers size={16} />,
  arrowUpDown: <ArrowUpDown size={16} />,
  columns3: <Columns3 size={16} />,
  code2: <Code2 size={16} />,
  barChart3: <BarChart3 size={16} />,
  calculator: <Calculator size={16} />,
  flipVertical2: <FlipVertical2 size={16} />,
};

export function NodePalette() {
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setShowImportModal = useCanvasStore((s) => s.setShowImportModal);
  const showCodeByDefault = usePreferencesStore((s) => s.showCodeByDefault);

  const handleAddNode = (type: string) => {
    const info = nodeTypeInfos.find((n) => n.type === type);
    if (!info) return;
    const supportsCodeMode = type !== 'dataSource' && type !== 'transform';
    const x = 120 + nodes.length * 320;
    const y = 120;
    addNode({
      id: `node-${Date.now()}`,
      type,
      position: { x, y },
      data: {
        ...info.defaultData,
        ...(supportsCodeMode ? { isCodeMode: showCodeByDefault } : {}),
      },
    });
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Data / get started */}
        <div className="border-b border-gray-100 px-3 py-2">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Data
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
            >
              <FileCode size={14} className="text-emerald-600" />
              Import Python
            </button>
          </div>
        </div>

        {/* Node types — click to add */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Nodes
          </p>
          <div className="space-y-1.5">
            {nodeTypeInfos.map((info) => (
              <button
                key={info.type}
                type="button"
                onClick={() => handleAddNode(info.type)}
                className="group flex w-full items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-left transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm"
              >
                <span className="flex-shrink-0 text-gray-400 group-hover:text-blue-500">
                  {iconMap[info.icon]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                    {info.label}
                  </div>
                  <div className="truncate text-[10px] text-gray-400">
                    {info.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="border-t border-gray-100 px-4 py-2.5">
          <p className="text-center text-[10px] text-gray-400">
            Connect nodes by dragging between handles
          </p>
        </div>
      </div>
    </>
  );
}
