import { getDatabase, nowTimestamp } from './database';

export interface WorkspaceSettings {
  police_station: string;
  district: string;
  state: string;
  halka: string;
  beat: string;
  officer_name: string;
}

const DEFAULT_WORKSPACE: WorkspaceSettings = {
  police_station: '',
  district: '',
  state: '',
  halka: '',
  beat: '',
  officer_name: '',
};

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<WorkspaceSettings>(
    'SELECT police_station, district, state, halka, beat, officer_name FROM workspace_settings WHERE id = ?',
    ['default']
  );
  return row ?? DEFAULT_WORKSPACE;
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO workspace_settings (id, police_station, district, state, halka, beat, officer_name, updated_at)
     VALUES ('default', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       police_station = excluded.police_station,
       district = excluded.district,
       state = excluded.state,
       halka = excluded.halka,
       beat = excluded.beat,
       officer_name = excluded.officer_name,
       updated_at = excluded.updated_at`,
    [settings.police_station, settings.district, settings.state,
     settings.halka, settings.beat, settings.officer_name, now]
  );
}
