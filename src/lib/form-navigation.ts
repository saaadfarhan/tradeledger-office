const FORM_CONTROL_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"])',
  "textarea",
  "select",
  '[role="combobox"]',
  '[data-slot="select-trigger"]',
  "[data-enter-navigation-control]",
].join(", ");

function isAvailableFormControl(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return (
    !element.matches(":disabled") &&
    !element.hasAttribute("readonly") &&
    element.getAttribute("aria-disabled") !== "true" &&
    element.tabIndex >= 0 &&
    !element.closest("[hidden], [inert], [aria-hidden='true']") &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

export function focusNextFormControl(current: HTMLElement) {
  const scope =
    current.closest<HTMLElement>('[role="dialog"], form, [data-slot="card"]') ??
    current.closest<HTMLElement>("main") ??
    document.body;
  const controls = Array.from(
    scope.querySelectorAll<HTMLElement>(FORM_CONTROL_SELECTOR),
  ).filter(isAvailableFormControl);
  const currentIndex = controls.indexOf(current);
  const next = controls[currentIndex + 1];
  if (!next) return false;
  next.focus();
  return true;
}

export function focusNextFormControlAfterSelection(id?: string) {
  if (!id) return;
  window.requestAnimationFrame(() => {
    const current = document.getElementById(id);
    if (current instanceof HTMLElement) focusNextFormControl(current);
  });
}
