// content — exact visible content extraction + designed-visible vs runtime-synthetic separation.
//
// Every visible text/icon node is A1_DESIGN evidence (`authority: "A1_DESIGN"`, `exact: true`) —
// the design's visible content is immutable and must never be replaced by synthetic mock data.
// A table's `designedVisibleRows` are the rows actually SHOWN in the design; the pagination footer
// ("Menampilkan 1-5 dari 215 data") supplies the RUNTIME contract (total/pageSize) — rows beyond the
// designed ones are RUNTIME_SYNTHETIC extension, never something to invent into the design.
//
// Pure — no project knowledge.

/** Extract exact visible content + tables + pagination runtime from a graph + topology results. */
export function extractExactContent(graph, classifications, topologies = []) {
  const nodes = graph.nodes ?? {};
  const content = [];
  const tables = [];

  const isVisible = (id) => {
    const c = classifications?.get(id);
    return !c || c.effectiveVisible;
  };

  // 1. Leaf content evidence — every visible text/icon node.
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (!isVisible(id)) continue;
    if (n.content?.kind === "TEXT") {
      if ((n.content.value ?? "").trim()) {
        content.push(contentEvidence(n, "TEXT", n.content.value, id));
      }
    } else if (n.content?.kind === "ICON") {
      content.push(contentEvidence(n, "ICON", n.content.glyphName ?? n.sourceName, id));
    }
  }

  // 2. Tables — a REPEATED region (vertical stack) with a header row + consistent data rows.
  for (const t of topologies) {
    if (t.family !== "REPEATED") continue;
    const tableNode = nodes[t.rootNodeId];
    if (!tableNode) continue;
    const rows = (tableNode.childIds ?? [])
      .map((id) => nodes[id])
      .filter((r) => r && isVisible(r.id) && r.absoluteBounds.w > 0 && r.absoluteBounds.h > 0);
    if (rows.length < 2) continue;

    const cellMatrix = rows.map((r) => textCellsOf(r, nodes, isVisible));
    const header = cellMatrix[0];
    const data = cellMatrix.slice(1);
    if (header.length < 1 || data.length < 1) continue;
    // A table needs consistent column counts across data rows.
    const counts = new Set(data.map((c) => c.length));
    if (counts.size > 1) continue;

    tables.push({
      tableNodeId: tableNode.id,
      headers: header.map((c, i) => ({ nodeId: c.nodeId, index: i, value: c.value, authority: "A1_DESIGN", exact: true })),
      designedVisibleRows: data.map((cells, i) => ({
        rowNodeId: rows[i + 1].id,
        cells: cells.map((c, j) => ({ nodeId: c.nodeId, index: j, value: c.value, authority: "A1_DESIGN", exact: true })),
      })),
      runtime: null, // filled from the page-level pagination footer below
    });
  }

  // 3. Pagination runtime (page-level) — parse the designed footer once.
  const pagination = extractPagination(nodes, isVisible);
  if (pagination && tables.length) {
    for (const table of tables) table.runtime = pagination.runtime;
  }

  return { content, tables, pagination };
}

function contentEvidence(node, kind, value, nodeId) {
  return {
    id: `content:${nodeId}`,
    nodeId,
    kind,
    value,
    visibility: "VISIBLE",
    authority: "A1_DESIGN",
    exact: true,
    sourceRef: node.provenance?.[0] ?? { path: node.id, source: "figml" },
  };
}

/** The visible text cells of a row, in document order. A table row's columns are its text values:
 *  a status badge contributes its label text (its icon is not a cell), and a divider/line is not a
 *  cell. DFS flattens inconsistent FIGML row wrappers (some rows nest their cells in a content frame). */
function textCellsOf(row, nodes, isVisible) {
  const cells = [];
  const collect = (node) => {
    if (!node || !isVisible(node.id)) return;
    if (node.content?.kind === "TEXT" && (node.content.value ?? "").trim()) {
      cells.push({ value: node.content.value.trim(), nodeId: node.id });
      return;
    }
    for (const cid of node.childIds ?? []) collect(nodes[cid]);
  };
  for (const cid of row.childIds ?? []) collect(nodes[cid]);
  return cells;
}

/** Parse the pagination footer ("Menampilkan 1-5 dari 215 data") into runtime state. */
function extractPagination(nodes, isVisible) {
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (!isVisible(id) || n.content?.kind !== "TEXT") continue;
    const t = (n.content.value ?? "").trim();
    if (!/menampilkan|showing\b/i.test(t) || !/data/i.test(t)) continue;
    const m = /(\d+)\s*-\s*(\d+)\s+(?:dari|of)\s+(\d+)/i.exec(t);
    if (!m) continue;
    const start = Number(m[1]);
    const end = Number(m[2]);
    const total = Number(m[3]);
    const pageSize = end - start + 1;
    if (pageSize <= 0 || total <= 0) continue;
    return {
      nodeId: id,
      text: t,
      runtime: { visibleStart: start, visibleEnd: end, pageSize, total, visiblePage: Math.ceil(end / pageSize) || 1 },
    };
  }
  return null;
}
