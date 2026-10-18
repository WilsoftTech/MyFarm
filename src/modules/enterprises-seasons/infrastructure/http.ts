/** Preserve unknown/duplicate keys for strict service validation, after authentication. */
export function productionPageInput(request: Request): Record<string, unknown> {
  const params = new URL(request.url).searchParams;
  // fromEntries creates own data properties even for keys such as __proto__.
  const input: Record<string, unknown> = Object.fromEntries(params);
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length > 1) input[key] = values;
  }
  if (typeof input.limit === "string") input.limit = Number(input.limit);
  return input;
}
