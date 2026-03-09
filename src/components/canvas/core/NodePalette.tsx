import { cn } from '@/lib/utils';
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
  FileInput,
  Search,
  MessageCircle,
  Brush,
} from 'lucide-react';
import { nodeTypeInfos } from '@/components/nodes';
import { useCanvasStore } from '@/stores/canvasStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import {
  label,
  paletteItem,
  paletteItemIcon,
  paletteItemTitle,
  paletteItemDescription,
  captionMuted,
  panelSection,
  panelSectionHeader,
  divider,
} from '@/flank';

const AI_NODE_TYPES = new Set(['aiQuery', 'aiAdvisor', 'aiCleanData']);

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
  search: <Search size={16} />,
  messageCircle: <MessageCircle size={16} />,
  brush: <Brush size={16} />,
};

export function NodePalette() {
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setShowImportModal = useCanvasStore((s) => s.setShowImportModal);
  const showCodeByDefault = usePreferencesStore((s) => s.showCodeByDefault);

  const handleAddNode = (type: string) => {
    const info = nodeTypeInfos.find((n) => n.type === type);
    if (!info) return;
    const supportsCodeMode =
      type !== 'dataSource' && type !== 'transform' && type !== 'aiQuery' && type !== 'aiAdvisor' && type !== 'aiCleanData';
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

  const sectionClass = cn(panelSection, 'border-b-0 py-1.5');
  const listGap = 'flex flex-col gap-0.5 mt-0.5';

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Sections: AI, Data, Nodes (alphabetical) */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
          {/* AI */}
          <div className={sectionClass}>
            <p className={label}>AI</p>
            <div className={listGap}>
              {nodeTypeInfos
                .filter((info) => AI_NODE_TYPES.has(info.type))
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((info) => (
                  <button
                    key={info.type}
                    type="button"
                    onClick={() => handleAddNode(info.type)}
                    className={paletteItem}
                  >
                    <span className={paletteItemIcon}>{iconMap[info.icon]}</span>
                    <div className="min-w-0 flex-1">
                      <div className={paletteItemTitle}>{info.label}</div>
                      <div className={paletteItemDescription}>{info.description}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Data */}
          <div className={sectionClass}>
            <p className={label}>Data</p>
            <div className={listGap}>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className={paletteItem}
              >
                <FileInput size={14} className={paletteItemIcon} />
                <span className={paletteItemTitle}>Import Python</span>
              </button>
            </div>
          </div>

          {/* Nodes */}
          <div className={sectionClass}>
            <p className={label}>Nodes</p>
            <div className={listGap}>
              {nodeTypeInfos
                .filter((info) => !AI_NODE_TYPES.has(info.type))
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((info) => (
                  <button
                    key={info.type}
                    type="button"
                    onClick={() => handleAddNode(info.type)}
                    className={paletteItem}
                  >
                    <span className={paletteItemIcon}>{iconMap[info.icon]}</span>
                    <div className="min-w-0 flex-1">
                      <div className={paletteItemTitle}>{info.label}</div>
                      <div className={paletteItemDescription}>{info.description}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className={cn(divider, panelSectionHeader, 'border-b-0 border-t-0 py-1.5')}>
          <p className={cn('text-center', captionMuted)}>
            Connect nodes by dragging between handles
          </p>
        </div>
      </div>
    </>
  );
}
