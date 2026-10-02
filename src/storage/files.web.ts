import * as DocumentPicker from 'expo-document-picker';
import { MAX_BACKUP_BYTES } from './workspace';

export async function pickBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], multiple: false, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0], file = asset.file;
  try {
    if (!file) throw new Error('The browser did not provide a readable file.');
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 5 MB limit.');
    return await file.text();
  } finally { if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri); }
}

export async function downloadBackup(text: string, name: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
