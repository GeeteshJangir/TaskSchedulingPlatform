/** Domain events emitted by CommentsService (consumed by activity P5.2 / notifications P6). */
export const COMMENT_CREATED = 'comment.created';
export const COMMENT_REPLIED = 'comment.replied';

export interface CommentCreatedEvent {
  commentId: string;
  taskId: string;
  authorId: string;
  parentCommentId: string | null;
}

export interface CommentRepliedEvent {
  commentId: string;
  taskId: string;
  parentCommentId: string;
  parentAuthorId: string;
  authorId: string;
}
