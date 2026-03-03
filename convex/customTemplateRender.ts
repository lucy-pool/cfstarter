"use node";

import { Maily } from "@maily-to/render";

/**
 * Substitute {{variable}} placeholders in a string.
 */
function substituteVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/**
 * Render a custom template to HTML.
 * Supports both Maily visual mode (JSON→HTML) and raw HTML mode.
 */
export async function renderCustomTemplate(
  editorMode: "visual" | "html",
  contentJson: string,
  contentHtml: string | undefined,
  variables: Record<string, string>,
  subjectTemplate: string
): Promise<{ html: string; subject: string }> {
  const subject = substituteVariables(subjectTemplate, variables);

  if (editorMode === "html") {
    // Raw HTML mode — just substitute variables
    const html = substituteVariables(contentHtml ?? "", variables);
    return { html, subject };
  }

  // Visual mode — render via Maily
  const content = JSON.parse(contentJson);
  const maily = new Maily(content);

  for (const [key, value] of Object.entries(variables)) {
    maily.setVariableValue(key, value);
  }

  const html = await maily.render();
  return { html, subject };
}
