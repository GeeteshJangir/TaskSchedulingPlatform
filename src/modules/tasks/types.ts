/** A node in a task subtree (nested), as returned by GET .../tasks/:id/subtree. */
export interface SubtreeNode {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: Date | null;
  depth: number;
  children: SubtreeNode[];
}
