import * as vscode from 'vscode';

// สมมติเรามีฟังก์ชัน parse/generate ที่ไม่มี Side Effect ชื่อ generateSwdCssFromSource
// คุณอาจจะดึงมาจาก createSwdCssCommand.ts หรือสร้างเวอร์ชัน noSideEffect แยกก็ได้
// ในที่นี้จะอ้างถึงจากไฟล์เดียวกัน (ลิงก์แบบ relative)
import { generateSwdCssFromSource } from './createSwdCssCommand';

// validateSwdDoc: ตรวจสอบไฟล์ .swd.ts เพื่อดูว่ามี error ตอน parse หรือไม่
// - ถ้ามี error => ใส่ Diagnostic
// - ถ้าไม่มี => ลบ Diagnostic
export function validateSwdDoc(
  doc: vscode.TextDocument,
  diagCollection: vscode.DiagnosticCollection
) {
  diagCollection.delete(doc.uri);

  try {
    const sourceText = doc.getText();
    generateSwdCssFromSource(sourceText);
  } catch (err: any) {
    const diag: vscode.Diagnostic = {
      message: err.message,
      severity: vscode.DiagnosticSeverity.Error,
      source: 'Styledwind Validate',
      range: new vscode.Range(0, 0, 0, 0),
    };
    diagCollection.set(doc.uri, [diag]);
  }
}
