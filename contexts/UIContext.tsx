import React, { createContext, useContext, useState, ReactNode } from 'react';

export type StatusType = 'success' | 'error' | 'info' | 'warning';

export type StatusConfig = {
  visible: boolean;
  type: StatusType;
  title: string;
  message: string;
};

type UIContextType = {
  statusConfig: StatusConfig;
  showStatus: (type: StatusType, title: string, message: string) => void;
  hideStatus: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [statusConfig, setStatusConfig] = useState<StatusConfig>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showStatus = (type: StatusType, title: string, message: string) => {
    setStatusConfig({ visible: true, type, title, message });
    if (type === 'success' || type === 'info') {
      setTimeout(() => hideStatus(), 2500);
    }
  };

  const hideStatus = () => {
    setStatusConfig((prev) => ({ ...prev, visible: false }));
  };

  return (
    <UIContext.Provider value={{ statusConfig, showStatus, hideStatus, isLoading, setIsLoading }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
