export type ActionState<T = unknown> = {
  ok?: boolean;
  error?: string; // translation key or plain message
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
};
export const initialState: ActionState = {};
