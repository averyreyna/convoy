export function SidebarHeader() {
  return (
    <div className="relative shrink-0 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Convoy</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Drag nodes onto the canvas
          </p>
        </div>
      </div>
    </div>
  );
}
