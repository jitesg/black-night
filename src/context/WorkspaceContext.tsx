import React, { createContext, useContext, useEffect, useState } from 'react';
import { setPersonCardDefaults } from '@/lib/personCard';
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

  // नये व्यक्ति card: थाना / जनपद पहले से भरे (owner)
  useEffect(() => {
    setPersonCardDefaults({ thana: workspace.police_station, district: workspace.district });
  }, [workspace.police_station, workspace.district]);

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
