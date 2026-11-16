/**
 * कार्यालय कागज़ check in the background (owner, चरण ग option क): Android runs this every ~15–30 minutes (WorkManager — the
 * phone decides the exact time; it may wait longer on battery saver). Defined from index.ts (InvestSuite build only) so it
 * exists before the app starts; registered while the phone is joined to a कार्यालय.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const OFFICE_SYNC_TASK = 'INVESTSUITE_OFFICE_SYNC';

TaskManager.defineTask(OFFICE_SYNC_TASK, async () => {
  try {
    const { getOfficerLink } = await import('./officerLink');
    if (!getOfficerLink()) return BackgroundTask.BackgroundTaskResult.Success;
    const { runOfficerSync } = await import('./officerSync');
    const r = await runOfficerSync({ notify: true });
    return r.error ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** On while joined, off after "अलग करें". */
export async function setOfficeBackgroundSync(on: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(OFFICE_SYNC_TASK);
    if (on && !registered) await BackgroundTask.registerTaskAsync(OFFICE_SYNC_TASK, { minimumInterval: 15 });
    if (!on && registered) await BackgroundTask.unregisterTaskAsync(OFFICE_SYNC_TASK);
  } catch { /* background work not allowed on this phone — app-open sync still works */ }
}
