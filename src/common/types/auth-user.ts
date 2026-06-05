/** Shape attached to request.user by the JWT strategy after authentication. */
export interface AuthUser {
  userId: string;
  email: string;
}
