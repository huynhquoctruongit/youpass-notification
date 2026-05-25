import { UserRow } from "../db/users";

export const toUserProfile = (user: UserRow) => ({
  id: user.id,
  email: user.email,
  fullname: user.fullname ?? undefined,
  date_created: new Date(user.created_at).toISOString(),
});
