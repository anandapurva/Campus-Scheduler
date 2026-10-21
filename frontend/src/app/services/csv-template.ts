
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CsvTemplateService {

  downloadTemplate(filename: string, headers: string[]): void {
    const csvContent = headers.join(',') + '\r\n';

    const blob = new Blob(
      ['\uFEFF' + csvContent],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }
}
