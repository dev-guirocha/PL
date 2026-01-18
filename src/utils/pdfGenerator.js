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

export const generatePulePDF = (pule) => {
  const doc = new jsPDF();

  // Cabeçalho
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PANDA LOTERIAS - PULE', 105, 13, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Loteria: ${(pule.loteria || '').toUpperCase()}`, 14, 30);
  if (pule.codigoHorario) doc.text(`Horário: ${pule.codigoHorario}`, 14, 36);
  if (pule.dataJogo) doc.text(`Data: ${formatDateBR(pule.dataJogo)}`, 14, 42);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Referência: ${pule.betRef || `${pule.userId || ''}-${pule.id || ''}`}`, 14, 48);

  const baseNumbers = (() => {
    if (Array.isArray(pule?.valendoBase?.numerosBase) && pule.valendoBase.numerosBase.length) {
      return pule.valendoBase.numerosBase;
    }
    const first = (pule.apostas || [])[0];
    if (Array.isArray(first?.palpites) && first.palpites.length) return first.palpites;
    return [];
  })();

  let startY = 55;
  if (baseNumbers.length) {
    doc.setFontSize(10);
    const baseLine = `Números base: ${baseNumbers.join(', ')}`;
    const wrapped = doc.splitTextToSize(baseLine, 180);
    doc.text(wrapped, 14, startY);
    startY += wrapped.length * 5 + 4;
  }

  const head = ['Modalidade', 'Colocação', 'Valor', 'Aplicação'];
  const body = (pule.apostas || []).map((ap) => [
    ap.modalidade || ap.jogo || '',
    ap.colocacao || '',
    `R$ ${(Number(ap.valorAposta) || 0).toFixed(2).replace('.', ',')}`,
    ap.modoValor === 'cada' ? 'Cada' : 'Todos',
  ]);

  autoTable(doc, {
    startY,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 10, cellPadding: 3 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total apostado: R$ ${(Number(pule.total) || 0).toFixed(2).replace('.', ',')}`, 14, finalY);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Documento gerado eletronicamente por Panda Loterias.', 105, finalY + 6, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, finalY + 10, { align: 'center' });

  const nomeArquivo = `PULE_${(pule.betRef || pule.id || 'pule')}.pdf`;
  doc.save(nomeArquivo);
};
