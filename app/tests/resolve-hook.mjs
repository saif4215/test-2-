export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && /^\.{1,2}\//.test(specifier)) return next(`${specifier}.js`, context);
    throw err;
  }
}
