declare module "@pdf-lib/fontkit" {
  const fontkit: {
    logErrors: boolean;
    registerFormat: (...args: unknown[]) => void;
    create: (...args: unknown[]) => unknown;
  };
  export default fontkit;
}
