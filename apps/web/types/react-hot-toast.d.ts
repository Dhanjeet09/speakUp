declare module "react-hot-toast" {
  import { ReactNode, ComponentType } from "react";

  type ToastType = "success" | "error" | "loading" | "blank" | "custom";
  type ToastPosition =
    | "top-left" | "top-center" | "top-right"
    | "bottom-left" | "bottom-center" | "bottom-right";

  interface ToastOptions {
    id?: string;
    duration?: number;
    icon?: ReactNode;
    position?: ToastPosition;
    style?: React.CSSProperties;
    className?: string;
    ariaProps?: Record<string, unknown>;
  }

  interface Toast {
    id: string;
    type: ToastType;
    message: ReactNode;
    icon?: ReactNode;
    duration?: number;
    position?: ToastPosition;
    ariaProps?: Record<string, unknown>;
    style?: React.CSSProperties;
    className?: string;
    createdAt: number;
    visible: boolean;
  }

  interface ToasterProps {
    position?: ToastPosition;
    toastOptions?: ToastOptions;
    reverseOrder?: boolean;
    gutter?: number;
    containerStyle?: React.CSSProperties;
    containerClassName?: string;
  }

  export const Toaster: ComponentType<ToasterProps>;
  export const toast: {
    (message: ReactNode, options?: ToastOptions): string;
    success: (message: ReactNode, options?: ToastOptions) => string;
    error: (message: ReactNode, options?: ToastOptions) => string;
    loading: (message: ReactNode, options?: ToastOptions) => string;
    custom: (message: ReactNode, options?: ToastOptions) => string;
    dismiss: (id?: string) => void;
    remove: (id?: string) => void;
    promise: <T>(
      promise: Promise<T>,
      messages: { loading: ReactNode; success: ReactNode | ((data: T) => ReactNode); error: ReactNode | ((error: unknown) => ReactNode) },
      options?: ToastOptions
    ) => Promise<T>;
  };

  export default toast;
}
