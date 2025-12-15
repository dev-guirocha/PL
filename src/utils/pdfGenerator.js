import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getNomeBicho } from './bichos';
import { formatDateBR } from './date';

export const generateResultPDF = (resultado) => {
  const doc = new jsPDF(); // retrato A4

  // Cabeçalho
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PANDA LOTERIAS', 105, 13, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Loteria: ${(resultado.loteria || '').toUpperCase()}`, 14, 30);
  if (resultado.codigoHorario) doc.text(`Horário: ${resultado.codigoHorario}`, 14, 36);
  if (resultado.dataJogo) doc.text(`Data: ${formatDateBR(resultado.dataJogo)}`, 14, 42);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`ID do Resultado: #${resultado.id || resultado._id || '--'}`, 14, 48);

  // Dados
  const nums = typeof resultado.numeros === 'string' ? JSON.parse(resultado.numeros || '[]') : resultado.numeros || [];
  const gruposRaw =
    typeof resultado.grupos === 'string' ? JSON.parse(resultado.grupos || '[]') : resultado.grupos || [];
  const isBicho = gruposRaw.length > 0;

  const head = isBicho ? ['Pos.', 'Número', 'Grupo', 'Bicho'] : ['Dezenas Sorteadas'];
  const body = [];

  if (isBicho) {
    nums.forEach((num, idx) => {
      const g = gruposRaw[idx] || '--';
      const bicho = getNomeBicho(g) || '';
      body.push([`${idx + 1}º`, num, g, bicho.toUpperCase()]);
    });
  } else {
    body.push([nums.join(' - ')]);
  }

  autoTable(doc, {
    startY: 55,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 12, cellPadding: 3 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: { 0: { cellWidth: 'auto' } },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Documento gerado eletronicamente por Panda Loterias.', 105, finalY, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, finalY + 4, { align: 'center' });

  const dataNome = resultado.dataJogo ? formatDateBR(resultado.dataJogo).replace(/\//g, '-') : 'hoje';
  const nomeArquivo = `Resultado_${resultado.loteria || 'loteria'}_${dataNome}.pdf`;
  doc.save(nomeArquivo);
};
