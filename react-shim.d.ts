declare module "react" {
  export type ReactNode = any;
  export type ReactElement = any;
  export type FC<P = {}> = (props: P & { children?: ReactNode }) => ReactElement | null;
  export function useState<S>(initialState: S | (() => S)): [S, (value: S) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  const React: {
    createElement: (...args: any[]) => any;
  };
  export default React;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
