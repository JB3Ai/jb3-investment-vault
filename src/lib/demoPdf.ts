// A genuine one-page PDF generated locally; contains synthetic text only.
export function createDemoPdf(): Uint8Array {
  const content = 'BT /F1 24 Tf 55 760 Td (JB³ PRIVATE INVESTMENT VAULT) Tj 0 -40 Td /F1 12 Tf (SYNTHETIC DEMONSTRATION - NOT VERIFIED) Tj 0 -35 Td (No investment facts, contracts or financial evidence are supplied.) Tj 0 -24 Td (This PDF demonstrates the document reader only.) Tj 0 -24 Td (Confidential documents must use authenticated private storage.) Tj ET'.replace(/[^\x00-\x7f]/g, character => '\\' + character.charCodeAt(0).toString(8).padStart(3, '0'))
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + object + '\nendobj\n' })
  const xref = pdf.length
  pdf += 'xref\n0 6\n0000000000 65535 f \n'
  offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n' })
  pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF'
  return new TextEncoder().encode(pdf)
}
