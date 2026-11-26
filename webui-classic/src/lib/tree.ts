// Directory tree of a file list, filled in as directories are opened
import { lastSegment, pathChain } from './path';

export interface TreeNode {
  path: string;
  name: string;
  /** Paths of the subdirectories; undefined until the directory has been loaded */
  children?: string[];
}

export type Tree = ReadonlyMap<string, TreeNode>;

export const addDirectory = (tree: Tree, path: string, subdirectories: { path: string; name: string }[]): Tree => {
  const next = new Map(tree);

  // The directory may be opened directly (from search results), so add its parents too
  const chain = pathChain(path);
  chain.forEach((current, i) => {
    if (!next.has(current)) {
      next.set(current, { path: current, name: current === '/' ? '/' : lastSegment(current) });
    }

    if (i > 0) {
      const parent = next.get(chain[i - 1])!;
      if (parent.children && !parent.children.includes(current)) {
        next.set(parent.path, { ...parent, children: [...parent.children, current] });
      }
    }
  });

  for (const sub of subdirectories) {
    next.set(sub.path, { ...next.get(sub.path), path: sub.path, name: sub.name });
  }

  next.set(path, { ...next.get(path)!, children: subdirectories.map((s) => s.path) });
  return next;
};

export interface TreeRow {
  node: TreeNode;
  depth: number;
  /** Known children, or the next directory on the way to the current one */
  children: string[];
  expanded: boolean;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Visible rows of the tree in display order */
export const treeRows = (tree: Tree, expanded: ReadonlySet<string>, current: string): TreeRow[] => {
  const chain = pathChain(current);
  const rows: TreeRow[] = [];
  const visit = (path: string, depth: number) => {
    const node = tree.get(path);
    if (!node) {
      return;
    }

    const next = chain[chain.indexOf(path) + 1];
    const children =
      node.children ?? (chain.includes(path) && next !== undefined && tree.has(next) ? [next] : []);
    const isExpanded = expanded.has(path);
    rows.push({ node, depth, children, expanded: isExpanded });
    if (isExpanded) {
      [...children]
        .sort((a, b) => collator.compare(tree.get(a)?.name ?? a, tree.get(b)?.name ?? b))
        .forEach((child) => visit(child, depth + 1));
    }
  };

  visit('/', 0);
  return rows;
};
