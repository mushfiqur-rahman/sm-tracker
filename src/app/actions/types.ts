export interface FormState {
  error?: string;
  ok?: string;
  /** Echo of submitted values so fields keep their content after React 19 resets the form. */
  values?: Record<string, string>;
}
