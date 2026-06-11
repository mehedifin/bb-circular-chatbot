// sharp's published types don't resolve under "exports" with bundler module
// resolution; it is only used in the one-off icon script.
declare module "sharp";
