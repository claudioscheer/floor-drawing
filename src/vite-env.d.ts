/// <reference types="vite/client" />

declare module "alpinejs" {
  type AlpineComponentFactory = () => Record<string, unknown>;

  interface Alpine {
    data(name: string, callback: AlpineComponentFactory): void;
    start(): void;
    $data(el: Element): Record<string, unknown>;
  }

  const Alpine: Alpine;
  export default Alpine;
}

declare module "interactjs" {
  interface Interactable {
    unset(): Interactable;
    styleCursor(enabled: boolean): Interactable;
    draggable(enabled: boolean): Interactable;
    resizable(options: Record<string, unknown>): Interactable;
  }

  interface InteractStatic {
    (target: string): Interactable;
  }

  const interact: InteractStatic;
  export default interact;
}
