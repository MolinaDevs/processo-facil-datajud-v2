import type { VercelRequest, VercelResponse } from '@vercel/node';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';
import * as XLSX from 'xlsx';

interface ProcessResult {
  numeroProcesso: string;
  classeProcessual: string;
  codigoClasseProcessual: number;
  tribunal: string;
  orgaoJulgador: string;
  codigoOrgaoJulgador?: number;
  grau: string;
  sistemaProcessual: string;
  codigoSistema?: number;
  formatoProcesso: string;
  codigoFormato?: number;
  dataAjuizamento: string;
  ultimaAtualizacao: string;
  nivelSigilo?: number;
  codigoMunicipio?: number;
  movimentos: any[];
  assuntos: any[];
}

function formatDateSafely(dateValue: string | Date, format: 'date' | 'time' | 'datetime' = 'date'): string {
  if (!dateValue) return '';
  
  const sentinelValues = ['Não informado', 'N/A', 'n/a', 'não disponível'];
  
  if (typeof dateValue === 'string' && sentinelValues.some(s => dateValue.toLowerCase() === s.toLowerCase())) {
    return dateValue;
  }
  
  try {
    const date = new Date(dateValue);
    
    if (isNaN(date.getTime())) {
      return typeof dateValue === 'string' ? dateValue : '';
    }
    
    if (format === 'date') {
      return date.toLocaleDateString('pt-BR');
    } else if (format === 'time') {
      return date.toLocaleTimeString('pt-BR');
    } else {
      return date.toLocaleString('pt-BR');
    }
  } catch {
    return typeof dateValue === 'string' ? dateValue : '';
  }
}

async function generatePDF(processes: ProcessResult[], title: string = "Relatório de Processos", includeMovements: boolean = true, includeSubjects: boolean = true): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true
      });
      
      const buffers: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => {
        buffers.push(chunk);
      });
      
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        } catch (bufferError) {
          reject(new Error(`Erro ao criar buffer PDF: ${bufferError instanceof Error ? bufferError.message : 'desconhecido'}`));
        }
      });
      
      doc.on('error', (err: Error) => {
        reject(new Error(`Erro do PDFKit: ${err.message}`));
      });
      
      doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
      doc.moveDown(2);
      
      processes.forEach((process, index) => {
        if (index > 0) {
          doc.addPage();
        }
        
        doc.fontSize(14).font('Helvetica-Bold').text(`Processo: ${process.numeroProcesso}`);
        doc.moveDown(0.5);
        
        doc.fontSize(10).font('Helvetica');
        doc.text(`Classe Processual: ${process.classeProcessual}`);
        doc.text(`Tribunal: ${process.tribunal}`);
        doc.text(`Órgão Julgador: ${process.orgaoJulgador}`);
        doc.text(`Grau: ${process.grau}`);
        doc.text(`Sistema: ${process.sistemaProcessual} (${process.formatoProcesso})`);
        doc.text(`Data de Ajuizamento: ${formatDateSafely(process.dataAjuizamento)}`);
        doc.text(`Última Atualização: ${formatDateSafely(process.ultimaAtualizacao)}`);
        doc.moveDown(1);
        
        if (includeSubjects && process.assuntos && process.assuntos.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').text('Assuntos:');
          doc.fontSize(10).font('Helvetica');
          process.assuntos.forEach(subject => {
            doc.text(`• ${subject.nome} (${subject.codigo})`);
          });
          doc.moveDown(1);
        }
        
        if (includeMovements && process.movimentos && process.movimentos.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').text('Movimentações:');
          doc.fontSize(10).font('Helvetica');
          process.movimentos.forEach(movement => {
            const date = formatDateSafely(movement.dataHora, 'date');
            const time = formatDateSafely(movement.dataHora, 'time');
            doc.text(`• ${date} ${time} - ${movement.nome}`);
            if (movement.complemento) {
              doc.text(`  ${movement.complemento}`);
            }
          });
        }
      });
      
      doc.end();
    } catch (error) {
      reject(new Error(`Erro ao gerar PDF: ${error instanceof Error ? error.message : 'desconhecido'}`));
    }
  });
}

function generateCSV(processes: ProcessResult[], includeMovements: boolean = true, includeSubjects: boolean = true): string {
  const records: Record<string, any>[] = [];
  
  processes.forEach(process => {
    const record: Record<string, any> = {
      'Número do Processo': process.numeroProcesso,
      'Classe Processual': process.classeProcessual,
      'Código Classe': process.codigoClasseProcessual,
      'Tribunal': process.tribunal,
      'Órgão Julgador': process.orgaoJulgador,
      'Grau': process.grau,
      'Sistema': process.sistemaProcessual,
      'Formato': process.formatoProcesso,
      'Data de Ajuizamento': formatDateSafely(process.dataAjuizamento),
      'Última Atualização': formatDateSafely(process.ultimaAtualizacao),
    };
    
    if (includeSubjects && process.assuntos && process.assuntos.length > 0) {
      record['Assuntos'] = process.assuntos.map(s => s.nome).join('; ');
      record['Códigos dos Assuntos'] = process.assuntos.map(s => s.codigo).join('; ');
    } else {
      record['Assuntos'] = '';
      record['Códigos dos Assuntos'] = '';
    }
    
    // ⭐ AS 6 COLUNAS DOS ÚLTIMOS 3 ANDAMENTOS (mais recentes)
    if (includeMovements && process.movimentos && process.movimentos.length > 0) {
      record['Total de Movimentações'] = process.movimentos.length;
      
      const len = process.movimentos.length;
      record['Último Andamento'] = process.movimentos[len - 1]?.nome || '';
      record['Data Último Andamento'] = formatDateSafely(process.movimentos[len - 1]?.dataHora);
      
      record['Penúltimo Andamento'] = len >= 2 ? (process.movimentos[len - 2]?.nome || '') : '';
      record['Data Penúltimo Andamento'] = len >= 2 ? formatDateSafely(process.movimentos[len - 2]?.dataHora) : '';
      
      record['Antepenúltimo Andamento'] = len >= 3 ? (process.movimentos[len - 3]?.nome || '') : '';
      record['Data Antepenúltimo Andamento'] = len >= 3 ? formatDateSafely(process.movimentos[len - 3]?.dataHora) : '';
      
      const movementsText = process.movimentos.map((mov, idx) => {
        const date = formatDateSafely(mov.dataHora, 'date');
        const time = formatDateSafely(mov.dataHora, 'time');
        return `[${idx + 1}] ${date} ${time} - ${mov.nome}${mov.complemento ? ' | ' + mov.complemento : ''}`;
      }).join(' || ');
      
      record['Histórico Completo de Movimentações'] = movementsText;
    } else {
      record['Total de Movimentações'] = 0;
      record['Último Andamento'] = '';
      record['Data Último Andamento'] = '';
      record['Penúltimo Andamento'] = '';
      record['Data Penúltimo Andamento'] = '';
      record['Antepenúltimo Andamento'] = '';
      record['Data Antepenúltimo Andamento'] = '';
      record['Histórico Completo de Movimentações'] = '';
    }
    
    records.push(record);
  });
  
  return stringify(records, { 
    header: true,
    delimiter: ',',
    quoted: true,
    quoted_empty: true,
    bom: true
  });
}

function generateExcel(processes: ProcessResult[], includeMovements: boolean = true, includeSubjects: boolean = true): Buffer {
  const workbook = XLSX.utils.book_new();
  const mainData: any[] = [];
  
  processes.forEach(process => {
    const row: any = {
      'Número do Processo': process.numeroProcesso,
      'Classe Processual': process.classeProcessual,
      'Código Classe': process.codigoClasseProcessual,
      'Tribunal': process.tribunal,
      'Órgão Julgador': process.orgaoJulgador,
      'Código Órgão Julgador': process.codigoOrgaoJulgador || '',
      'Grau': process.grau,
      'Sistema': process.sistemaProcessual,
      'Código Sistema': process.codigoSistema || '',
      'Formato': process.formatoProcesso,
      'Código Formato': process.codigoFormato || '',
      'Data de Ajuizamento': formatDateSafely(process.dataAjuizamento),
      'Última Atualização': formatDateSafely(process.ultimaAtualizacao),
      'Nível de Sigilo': process.nivelSigilo || '',
      'Código Município': process.codigoMunicipio || '',
    };
    
    if (includeSubjects) {
      row['Assuntos'] = process.assuntos.map(s => `${s.nome} (${s.codigo})`).join('; ');
      row['Códigos Assuntos'] = process.assuntos.map(s => s.codigo).join('; ');
    }
    
    row['Quantidade de Movimentos'] = process.movimentos.length;
    
    // ⭐ AS 6 COLUNAS DOS ÚLTIMOS 3 ANDAMENTOS (mais recentes)
    if (includeMovements && process.movimentos.length > 0) {
      const len = process.movimentos.length;
      row['Último Andamento'] = process.movimentos[len - 1]?.nome || '';
      row['Data Último Andamento'] = formatDateSafely(process.movimentos[len - 1]?.dataHora);
      
      row['Penúltimo Andamento'] = len >= 2 ? (process.movimentos[len - 2]?.nome || '') : '';
      row['Data Penúltimo Andamento'] = len >= 2 ? formatDateSafely(process.movimentos[len - 2]?.dataHora) : '';
      
      row['Antepenúltimo Andamento'] = len >= 3 ? (process.movimentos[len - 3]?.nome || '') : '';
      row['Data Antepenúltimo Andamento'] = len >= 3 ? formatDateSafely(process.movimentos[len - 3]?.dataHora) : '';
    } else {
      row['Último Andamento'] = '';
      row['Data Último Andamento'] = '';
      row['Penúltimo Andamento'] = '';
      row['Data Penúltimo Andamento'] = '';
      row['Antepenúltimo Andamento'] = '';
      row['Data Antepenúltimo Andamento'] = '';
    }
    
    mainData.push(row);
  });
  
  const mainSheet = XLSX.utils.json_to_sheet(mainData);
  
  const wscols = [
    { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 30 },
    { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
    { wch: 50 }, { wch: 30 }, { wch: 22 }, { wch: 50 }, { wch: 18 },
    { wch: 50 }, { wch: 18 }, { wch: 50 }, { wch: 18 },
  ];
  mainSheet['!cols'] = wscols;
  
  XLSX.utils.book_append_sheet(workbook, mainSheet, "Processos");
  
  if (includeMovements) {
    const movementsData: any[] = [];
    
    processes.forEach(process => {
      process.movimentos.forEach((movement, index) => {
        movementsData.push({
          'Número do Processo': process.numeroProcesso,
          'Sequência': index + 1,
          'Data': formatDateSafely(movement.dataHora, 'date'),
          'Hora': formatDateSafely(movement.dataHora, 'time'),
          'Código Movimento': movement.codigo || '',
          'Nome do Movimento': movement.nome,
          'Complemento': movement.complemento || '',
        });
      });
    });
    
    if (movementsData.length > 0) {
      const movSheet = XLSX.utils.json_to_sheet(movementsData);
      XLSX.utils.book_append_sheet(workbook, movSheet, "Movimentações");
    }
  }
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function generateJSON(processes: ProcessResult[], includeMovements: boolean = true, includeSubjects: boolean = true): string {
  const filteredProcesses = processes.map(process => {
    const filtered: any = {
      numeroProcesso: process.numeroProcesso,
      classeProcessual: process.classeProcessual,
      tribunal: process.tribunal,
      orgaoJulgador: process.orgaoJulgador,
      grau: process.grau,
      sistemaProcessual: process.sistemaProcessual,
      formatoProcesso: process.formatoProcesso,
      dataAjuizamento: process.dataAjuizamento,
      ultimaAtualizacao: process.ultimaAtualizacao,
    };
    
    if (includeSubjects) {
      filtered.assuntos = process.assuntos;
    }
    
    if (includeMovements) {
      filtered.movimentos = process.movimentos;
    }
    
    return filtered;
  });
  
  return JSON.stringify({
    metadata: {
      geradoEm: new Date().toISOString(),
      totalProcessos: processes.length,
      includeMovimentos: includeMovements,
      includeAssuntos: includeSubjects,
    },
    processos: filteredProcesses,
  }, null, 2);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    try {
      const { format, data, title, includeMovements, includeSubjects } = req.body;
      
      if (!data || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nenhum dado fornecido para exportação"
        });
      }

      const filename = `processos_${new Date().toISOString().split('T')[0]}`;
      
      switch (format) {
        case "pdf":
          const pdfBuffer = await generatePDF(data, title, includeMovements, includeSubjects);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
          res.send(pdfBuffer);
          break;
          
        case "csv":
          const csvContent = generateCSV(data, includeMovements, includeSubjects);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.send(csvContent);
          break;
          
        case "excel":
          const excelBuffer = generateExcel(data, includeMovements, includeSubjects);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          res.send(excelBuffer);
          break;
          
        case "json":
          const jsonContent = generateJSON(data, includeMovements, includeSubjects);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.send(jsonContent);
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: "Formato de exportação não suportado"
          });
      }
    } catch (error) {
      console.error("[Export] Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro na exportação de dados"
      });
    }
  } else {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }
}
