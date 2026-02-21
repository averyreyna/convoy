import { type DragEvent, useState } from 'react';
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
  GripVertical,
  Wand2,
} from 'lucide-react';
import { nodeTypeInfos } from '@/components/nodes';
import { PipelinePrompt } from './PipelinePrompt';

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
  const [showPrompt, setShowPrompt] = useState(false);

  const onDragStart = (
    event: DragEvent<HTMLDivElement>,
    nodeType: string
  ) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-gray-100 px-3 py-3">
          <button
            onClick={() => setShowPrompt(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:from-blue-600 hover:to-indigo-600 hover:shadow-md active:from-blue-700 active:to-indigo-700"
          >
            <Wand2 size={16} />
            Build from description
          </button>
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1.5">
            {nodeTypeInfos.map((info) => (
              <div
                key={info.type}
                className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-3 py-2.5 transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm active:cursor-grabbing"
                draggable
                onDragStart={(e) => onDragStart(e, info.type)}
              >
                <GripVertical
                  size={12}
                  className="flex-shrink-0 text-gray-300 group-hover:text-gray-400"
                />
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
              </div>
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

      {/* Pipeline Prompt modal - rendered outside sidebar */}
      {showPrompt && (
        <div className="fixed inset-0 z-50">
          <PipelinePrompt onClose={() => setShowPrompt(false)} />
        </div>
      )}
    </>
  );
}
