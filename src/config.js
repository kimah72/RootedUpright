// Production is served from kimberlyminer.com/RootedUpright/, dev from localhost
export const appUrl = import.meta.env.PROD
  ? "https://kimberlyminer.com/RootedUpright/"
  : "http://localhost:5174";
