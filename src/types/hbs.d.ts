declare module 'hbs' {
  function registerHelper(name: string, fn: (...args: any[]) => any): void;
  function registerPartial(name: string, partial: string): void;
  export default { registerHelper, registerPartial };
}
