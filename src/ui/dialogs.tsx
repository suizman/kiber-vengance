import { render } from "preact";
import { translate } from "./i18n";

export interface DialogField {
  name: string;
  label: string;
  type?: "text" | "number" | "select";
  value?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | "any";
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
}
export interface FieldsRequest {
  title: string;
  description?: string;
  fields: DialogField[];
  submitLabel?: string;
  destructive?: boolean;
}
let sequence = 0;
let queue: Promise<unknown> = Promise.resolve();

/** One accessible, validated modal workflow for user-authored project changes. */
export function requestFields(
  request: FieldsRequest,
): Promise<Record<string, string> | null> {
  const result = queue.then(() => openFields(request));
  queue = result.catch(() => null);
  return result;
}

function openFields(
  request: FieldsRequest,
): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "studio-dialog field-dialog";
    dialog.dataset.requestDialog = "";
    const titleId = `field-dialog-title-${++sequence}`;
    dialog.setAttribute("aria-labelledby", titleId);
    const previousFocus = document.activeElement;
    let settled = false;
    const finish = (value: Record<string, string> | null) => {
      if (settled) return;
      settled = true;
      dialog.close();
      render(null, dialog);
      dialog.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
      resolve(value);
    };
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => finish(null));
    document.body.append(dialog);
    render(
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          if (!form.reportValidity()) return;
          const values: Record<string, string> = {};
          for (const field of request.fields) {
            const input = form.elements.namedItem(field.name) as
              HTMLInputElement | HTMLSelectElement;
            const value = input.value.trim();
            if (field.required !== false && !value) {
              input.setCustomValidity(
                translate("Enter a value.", "Introduce un valor."),
              );
              input.reportValidity();
              return;
            }
            if (
              field.type === "number" &&
              value &&
              !Number.isFinite(Number(value))
            ) {
              input.setCustomValidity(
                translate(
                  "Enter a valid number.",
                  "Introduce un número válido.",
                ),
              );
              input.reportValidity();
              return;
            }
            values[field.name] = value;
          }
          finish(values);
        }}
      >
        <h2 id={titleId}>{request.title}</h2>
        {request.description && <p>{request.description}</p>}
        <div class="dialog-fields">
          {request.fields.map((field) => (
            <label key={field.name} class="dialog-field">
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select
                  name={field.name}
                  defaultValue={String(field.value ?? "")}
                  required={field.required !== false}
                  onInput={(event) => event.currentTarget.setCustomValidity("")}
                >
                  {field.options?.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "number" ? (
                <input
                  name={field.name}
                  type="number"
                  defaultValue={String(field.value ?? "")}
                  required={field.required !== false}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  autoComplete="off"
                  onInput={(event) => event.currentTarget.setCustomValidity("")}
                />
              ) : (
                <input
                  name={field.name}
                  type="text"
                  defaultValue={String(field.value ?? "")}
                  required={field.required !== false}
                  maxLength={field.maxLength ?? 160}
                  autoComplete="off"
                  onInput={(event) => event.currentTarget.setCustomValidity("")}
                />
              )}
            </label>
          ))}
        </div>
        <div class="dialog-actions">
          <button type="button" onClick={() => finish(null)}>
            {translate("Cancel", "Cancelar")}
          </button>
          <button
            type="submit"
            class={request.destructive ? "danger" : "primary"}
          >
            {request.submitLabel ?? translate("Save", "Guardar")}
          </button>
        </div>
      </form>,
      dialog,
    );
    dialog.showModal();
    const input = dialog.querySelector<HTMLInputElement>("input");
    if (input) {
      input.focus();
      if (input.type === "text") input.select();
    }
  });
}

export async function requestText(
  title: string,
  value = "",
  label = title,
): Promise<string | null> {
  const result = await requestFields({
    title,
    fields: [{ name: "value", label, value }],
  });
  return result?.value ?? null;
}
export async function requestNumber(
  title: string,
  value: number,
  min: number,
  max: number,
  step: number = 1,
): Promise<number | null> {
  const result = await requestFields({
    title,
    fields: [
      { name: "value", label: title, type: "number", value, min, max, step },
    ],
  });
  return result ? Number(result.value) : null;
}
export async function requestConfirmation(
  title: string,
  description: string,
): Promise<boolean> {
  return (
    (await requestFields({
      title,
      description,
      fields: [],
      submitLabel: translate("Delete", "Borrar"),
      destructive: true,
    })) !== null
  );
}
