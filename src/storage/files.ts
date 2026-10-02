import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MAX_BACKUP_BYTES } from './workspace';

export async function pickBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 5 MB limit.');
    return await file.text();
  } finally { if (file.exists && file.uri.startsWith(Paths.cache.uri)) file.delete(); }
}

export async function downloadBackup(text: string, name: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true }); file.write(text);
  // The receiving app may read after the share sheet closes. Let the OS manage this cache copy.
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save party backup' });
}
