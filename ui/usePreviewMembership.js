import { useCallback } from "react";
import { useStore } from "@xyflow/react";
import { previewPool, visiblePreviews, preserveMembers } from "./preview-pool.js";

export function usePreviewMembership({ nodes, area, selected, active, retained, limit, playing }) {
  // The workbench needs membership changes, not every camera position. The
  // renderer subscribes to the camera independently, so UI controls and graph
  // props stay stable while the same sources remain visible.
  return useStore(useCallback(state => {
    const [x, y, zoom] = state.transform, viewport = { x, y, zoom };
    const previews = visiblePreviews(nodes, viewport, area);
    const mounted = previewPool({ nodes, viewport, area, selected, active, retained, limit, playing });
    if (!playing) for (const node of nodes) if (mounted.size < limit && previews.has(node.id) && node.data.url && !node.data.domUrl) mounted.add(node.id);
    return { previews, mounted };
  }, [nodes, area, selected, active, retained, limit, playing]), equalMembership);
}

function equalMembership(previous, next) {
  return preserveMembers(previous.previews, next.previews) === previous.previews && preserveMembers(previous.mounted, next.mounted) === previous.mounted;
}
