import React, { createContext, useContext, useEffect, useState } from 'react';
import { getWorkspaceSettings, saveWorkspaceSettings, WorkspaceSettings } from '@/lib/db/workspaceRepo';

interface WorkspaceContextType {
  workspace: WorkspaceSettings;
  isLoaded: boolean;
  updateWorkspace: (settings: WorkspaceSettings) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: { police_station: '', district: '', state: '', halka: '', beat: '', officer_name: '' },
  isLoaded: false,
  updateWorkspace: async () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceSettings>({
    police_station: '',
    district: '',
    state: '',
    halka: '',
    beat: '',
    officer_name: '',
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await getWorkspaceSettings();
      setWorkspace(settings);
      setIsLoaded(true);
    })();
  }, []);

  const updateWorkspace = async (settings: WorkspaceSettings) => {
    await saveWorkspaceSettings(settings);
    setWorkspace(settings);
  };

  return (
    <WorkspaceContext.Provider value={{ workspace, isLoaded, updateWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
