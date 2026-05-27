export async function fileToDataUrl(file?: File | null): Promise<string> {
  if (!file) return '';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la foto.'));
    reader.readAsDataURL(file);
  });
}
