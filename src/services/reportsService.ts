import { jsPDF } from 'jspdf';
import { buildLoteResumen } from './calculationsService';
import { calcularEconomiaLote, calcularPrediccionSalida } from './adminAnalyticsService';
import { db } from './localDbService';
import { makeLiquidationCostId } from './loteLiquidationService';
import { enqueueSync } from './syncService';
import { createId } from '../lib/id';
import { nowISO, todayISO } from '../lib/date';
import { fmtCurrency, fmtKg, fmtNumber, fmtPercent } from '../lib/format';
import type { Lote, ReportePDF, Usuario } from '../types/entities';

export async function generarReporteLotePDF(lote: Lote, user: Usuario): Promise<ReportePDF> {
  const today = todayISO();
  const [registros, consumos, pesajes, loteGalpones, galpones, actividades, vacunas, syncQueue, tratamientos, eventos, costos, salidas, facturasCompra, facturasVenta, curvas, alertas, proveedores] =
    await Promise.all([
      db.registroDiarioLote.where('LoteID').equals(lote.LoteID).toArray(),
      db.consumosAlimentoLote.where('LoteID').equals(lote.LoteID).toArray(),
      db.pesajes.where('LoteID').equals(lote.LoteID).toArray(),
      db.loteGalpones.where('LoteID').equals(lote.LoteID).toArray(),
      db.galpones.toArray(),
      db.actividadesLote.where('LoteID').equals(lote.LoteID).toArray(),
      db.vacunasLote.where('LoteID').equals(lote.LoteID).toArray(),
      db.syncQueue.toArray(),
      db.tratamientosVeterinarios.where('LoteID').equals(lote.LoteID).toArray(),
      db.eventosSanitarios.where('LoteID').equals(lote.LoteID).toArray(),
      db.costosLote.where('LoteID').equals(lote.LoteID).toArray(),
      db.salidasPollo.where('LoteID').equals(lote.LoteID).toArray(),
      db.facturasCompra.toArray(),
      db.facturasVenta.toArray(),
      db.curvasEstandar.toArray(),
      db.alertas.where('LoteID').equals(lote.LoteID).toArray(),
      db.proveedores.toArray(),
    ]);

  const galponNamesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon.NombreGalpon]));
  const resumen = buildLoteResumen({
    lote,
    registros,
    consumos,
    pesajes,
    loteGalpones,
    galponNamesById,
    actividades,
    vacunas,
    syncQueue,
    today,
  });

  const economia = calcularEconomiaLote({ lote, costos, salidas });
  const prediccion = calcularPrediccionSalida({ lote, pesajes, curvas, costos, registros, pesoObjetivoGr: 2500 });
  const proveedorPollito = proveedores.find((proveedor) => proveedor.ProveedorID === lote.ProveedorPollitoID)?.NombreProveedor ?? '';

  const doc = new jsPDF();
  let y = 18;
  const addLine = (text: string, indent = 14) => {
    if (y > 278) {
      doc.addPage();
      y = 18;
    }
    doc.text(text, indent, y, { maxWidth: 180 });
    y += 7;
  };
  const addSection = (title: string, lines: string[]) => {
    y += 4;
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    addLine(title);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    lines.forEach((line) => addLine(line));
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`POLLOS - Reporte completo ${lote.CodigoLote}`, 14, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  addLine(`Generado: ${new Date().toLocaleString('es-CO')}`);

  addSection('1. Datos generales', [
    `Fecha llegada: ${lote.FechaLlegada}`,
    `Proveedor pollito: ${proveedorPollito || lote.ProveedorPollitoID || 'Sin proveedor'}`,
    `Galpones usados: ${resumen.Galpones.join(', ') || 'Sin asignar'}`,
    `Edad actual/final: ${resumen.DiaLote} dias`,
    `Inicial: ${fmtNumber(lote.CantidadInicialTotal)} aves (${fmtNumber(lote.CantidadInicialMachos)} M / ${fmtNumber(lote.CantidadInicialHembras)} H)`,
    `Aves vivas: ${fmtNumber(resumen.AvesVivasTotal)} (${fmtNumber(resumen.MachosVivos)} M / ${fmtNumber(resumen.HembrasVivas)} H)`,
  ]);

  addSection('2. Tecnico', [
    `Mortalidad acumulada: ${fmtPercent(resumen.MortalidadAcumulada)}`,
    `Consumo acumulado: ${fmtKg(resumen.ConsumoAcumuladoKg)}`,
    `Peso promedio general: ${fmtKg(resumen.PesoPromedioGeneralKg, 3)}`,
    `Conversion actual: ${fmtNumber(resumen.ConversionAlimenticia, 2)}`,
    `Vacunas aplicadas: ${vacunas.filter((vacuna) => vacuna.Estado === 'APLICADA').length}`,
    `Vacunas pendientes/vencidas: ${vacunas.filter((vacuna) => vacuna.Estado !== 'APLICADA').length}`,
    `Tratamientos veterinarios: ${tratamientos.length}`,
    `Eventos sanitarios: ${eventos.length}`,
    `Actividades no realizadas/vencidas: ${actividades.filter((actividad) => actividad.Estado === 'NO_REALIZADA' || actividad.Estado === 'VENCIDA').length}`,
  ]);

  addSection('3. Economico', [
    `Costo pollito: ${fmtCurrency(sumCostos(costos, 'POLLITO'))}`,
    `Costo alimento: ${fmtCurrency(sumCostos(costos, 'ALIMENTO'))}`,
    `Costo cisco: ${fmtCurrency(sumCostos(costos, 'CISCO'))}`,
    `Costo gas: ${fmtCurrency(sumCostos(costos, 'GAS'))}`,
    `Medicamentos/vacunas: ${fmtCurrency(sumCostos(costos, 'MEDICAMENTO') + sumCostos(costos, 'VACUNA'))}`,
    `Otros costos: ${fmtCurrency(costos.filter((costo) => !['POLLITO', 'ALIMENTO', 'CISCO', 'GAS', 'MEDICAMENTO', 'VACUNA'].includes(costo.CategoriaCosto)).reduce((sum, costo) => sum + costo.ValorTotal, 0))}`,
    `Costo total: ${fmtCurrency(economia.costoTotal)}`,
    `Kg vendidos: ${fmtKg(economia.kgVendidos)}`,
    `Ingreso total: ${fmtCurrency(economia.ingresoTotal)}`,
    `Utilidad bruta: ${fmtCurrency(economia.utilidadBruta)}`,
    `Costo por ave inicial: ${fmtCurrency(economia.costoPorAveInicial)}`,
    `Costo por kg: ${fmtCurrency(economia.costoPorKg)}`,
    `Utilidad por kg: ${fmtCurrency(economia.utilidadPorKg)}`,
    `Margen: ${fmtPercent(economia.margen)}`,
  ]);

  addSection('4. Facturas y salidas', [
    `Facturas compra registradas: ${facturasCompra.length}`,
    `Facturas venta registradas: ${facturasVenta.length}`,
    `Salidas/ventas del lote: ${salidas.length}`,
    `Ventas pendientes de precio/factura: ${salidas.filter((salida) => salida.EstadoAdministrativo !== 'COMPLETO').length}`,
  ]);

  addSection('5. Prediccion de salida', [
    `Peso objetivo usado: ${fmtNumber(prediccion.pesoObjetivoGr)} g`,
    `Peso actual: ${fmtNumber(prediccion.pesoActualGr)} g`,
    `Ganancia diaria estimada: ${fmtNumber(prediccion.gananciaDiariaGr, 1)} g/dia`,
    `Dias estimados: ${fmtNumber(prediccion.diasEstimados, 1)}`,
    `Fecha estimada: ${prediccion.fechaEstimada}`,
    `Consumo adicional esperado: ${fmtKg(prediccion.consumoAdicionalKg)}`,
    `Costo adicional estimado: ${fmtCurrency(prediccion.costoAdicionalEstimado)}`,
  ]);

  addSection('6. Alertas', alertas.length ? alertas.slice(0, 12).map((alerta) => `${alerta.Nivel}: ${alerta.TipoAlerta} - ${alerta.Mensaje}`) : ['Sin alertas registradas.']);

  addSection('7. Tratamientos veterinarios', tratamientos.length ? tratamientos.map((tratamiento) => `${tratamiento.Producto} (${tratamiento.Estado}) retiro ${tratamiento.PeriodoRetiroDias} dias`) : ['Sin tratamientos registrados.']);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const reporte: ReportePDF = {
    ReporteID: createId('reporte'),
    LoteID: lote.LoteID,
    FechaGeneracion: nowISO(),
    TipoReporte: 'COMPLETO',
    URLArchivo: url,
    GeneradoPor: user.UsuarioID,
  };
  await db.reportesPDF.add(reporte);
  await enqueueSync('ReportesPDF', reporte.ReporteID, 'CREATE', reporte);
  return reporte;
}

export async function generarReporteLiquidacionLotePDF(lote: Lote, user: Usuario): Promise<ReportePDF> {
  const [registros, tipos, costos, salidas, cierres] = await Promise.all([
    db.registroDiarioLote.where('LoteID').equals(lote.LoteID).toArray(),
    db.tiposAlimento.toArray(),
    db.costosLote.where('LoteID').equals(lote.LoteID).toArray(),
    db.salidasPollo.where('LoteID').equals(lote.LoteID).toArray(),
    db.cierreLote.where('LoteID').equals(lote.LoteID).toArray(),
  ]);
  const cierre = cierres.sort((left, right) => right.FechaCierre.localeCompare(left.FechaCierre))[0];
  const tiposById = new Map(tipos.map((tipo) => [tipo.TipoAlimentoID, tipo]));
  const costoById = new Map(costos.map((costo) => [costo.CostoID, costo]));
  const feedRows = [...new Set(registros.map((registro) => registro.TipoAlimentoID).filter(Boolean))]
    .map((tipoAlimentoId) => {
      const tipo = tiposById.get(tipoAlimentoId);
      const registrosTipo = registros.filter((registro) => registro.TipoAlimentoID === tipoAlimentoId);
      const bultos = registrosTipo.reduce((sum, registro) => sum + registro.BultosConsumidos, 0);
      const kg = registrosTipo.reduce((sum, registro) => sum + registro.KgConsumidos, 0);
      const costo = costoById.get(makeLiquidationCostId(lote.LoteID, `alimento_${tipoAlimentoId}`));
      return {
        nombre: tipo?.Nombre ?? tipoAlimentoId,
        bultos,
        kg,
        precioBulto: costo?.ValorUnitario ?? 0,
        total: costo?.ValorTotal ?? 0,
      };
    })
    .sort((left, right) => left.nombre.localeCompare(right.nombre));
  const materialRows = (['CISCO', 'GAS'] as const).map((tipoMaterial) => {
    const costo = costoById.get(makeLiquidationCostId(lote.LoteID, `material_${tipoMaterial}`));
    return {
      nombre: tipoMaterial === 'CISCO' ? 'Cisco' : 'Gas',
      cantidad: costo?.Cantidad ?? 0,
      unidad: costo?.Unidad ?? (tipoMaterial === 'CISCO' ? 'PACAS' : 'CILINDROS'),
      precioUnitario: costo?.ValorUnitario ?? 0,
      total: costo?.ValorTotal ?? 0,
    };
  });
  const totalCostos = costos.reduce((sum, costo) => sum + costo.ValorTotal, 0);
  const totalIngresos = salidas.reduce((sum, salida) => sum + salida.ValorTotal, 0);
  const utilidad = totalIngresos - totalCostos;
  const kgCanal = salidas.reduce((sum, salida) => sum + salida.PesoTotalKg, 0);
  const avesSalida = salidas.reduce((sum, salida) => sum + salida.CantidadAves, 0);
  const muertos = registros.reduce((sum, registro) => sum + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar, 0);
  const consumoKg = registros.reduce((sum, registro) => sum + registro.KgConsumidos, 0);
  const conversion = kgCanal > 0 ? consumoKg / kgCanal : 0;

  const doc = new jsPDF();
  let y = 18;
  const addLine = (text: string, indent = 14) => {
    if (y > 278) {
      doc.addPage();
      y = 18;
    }
    doc.text(text, indent, y, { maxWidth: 180 });
    y += 7;
  };
  const addSection = (title: string, lines: string[]) => {
    y += 4;
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    addLine(title);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    lines.forEach((line) => addLine(line));
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`POLLOS - Liquidacion ${lote.CodigoLote}`, 14, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  addLine(`Generado: ${new Date().toLocaleString('es-CO')}`);
  addLine(`Estado lote: ${lote.EstadoLote}`);
  addLine(`Fecha cierre: ${cierre?.FechaCierre ?? 'Sin cierre guardado'}`);

  addSection('1. Resultado', [
    `Aves iniciales: ${fmtNumber(lote.CantidadInicialTotal)}`,
    `Aves salidas: ${fmtNumber(avesSalida)}`,
    `Muertos: ${fmtNumber(muertos)} (${fmtPercent(lote.CantidadInicialTotal > 0 ? muertos / lote.CantidadInicialTotal : 0)})`,
    `Kg canal: ${fmtKg(kgCanal)}`,
    `Conversion final: ${fmtNumber(cierre?.ConversionFinal ?? conversion, 2)}`,
    `Ingresos: ${fmtCurrency(totalIngresos)}`,
    `Costos: ${fmtCurrency(totalCostos)}`,
    `Utilidad: ${fmtCurrency(cierre?.UtilidadBruta ?? utilidad)}`,
    `Margen: ${fmtPercent(totalIngresos > 0 ? utilidad / totalIngresos : 0)}`,
  ]);

  addSection(
    '2. Alimento',
    feedRows.length
      ? feedRows.map((row) => `${row.nombre}: ${fmtNumber(row.bultos, 1)} bultos / ${fmtKg(row.kg)} x ${fmtCurrency(row.precioBulto)} = ${fmtCurrency(row.total)}`)
      : ['Sin consumo de alimento registrado.'],
  );

  addSection(
    '3. Cisco y gas',
    materialRows.map((row) => `${row.nombre}: ${fmtNumber(row.cantidad, 1)} ${row.unidad.toLowerCase()} x ${fmtCurrency(row.precioUnitario)} = ${fmtCurrency(row.total)}`),
  );

  addSection(
    '4. Salidas a matadero',
    salidas.length
      ? salidas
        .slice()
        .sort((left, right) => left.Fecha.localeCompare(right.Fecha))
        .map((salida) =>
          `${salida.Fecha}: ${fmtNumber(salida.CantidadAves)} aves, ${fmtKg(salida.PesoTotalKg)}, ${fmtCurrency(salida.PrecioKg)}/kg = ${fmtCurrency(salida.ValorTotal)} (${salida.EstadoAdministrativo})`,
        )
      : ['Sin salidas registradas.'],
  );

  addSection(
    '5. Otros costos',
    costos.filter((costo) => !['ALIMENTO', 'CISCO', 'GAS'].includes(costo.CategoriaCosto)).length
      ? costos
        .filter((costo) => !['ALIMENTO', 'CISCO', 'GAS'].includes(costo.CategoriaCosto))
        .map((costo) => `${costo.CategoriaCosto} - ${costo.Concepto}: ${fmtCurrency(costo.ValorTotal)}`)
        .slice(0, 20)
      : ['Sin otros costos registrados.'],
  );

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const reporte: ReportePDF = {
    ReporteID: createId('reporte'),
    LoteID: lote.LoteID,
    FechaGeneracion: nowISO(),
    TipoReporte: 'ECONOMICO',
    URLArchivo: url,
    GeneradoPor: user.UsuarioID,
  };
  await db.reportesPDF.add(reporte);
  await enqueueSync('ReportesPDF', reporte.ReporteID, 'CREATE', reporte);
  return reporte;
}

function sumCostos(costos: Array<{ CategoriaCosto: string; ValorTotal: number }>, categoria: string): number {
  return costos.filter((costo) => costo.CategoriaCosto === categoria).reduce((sum, costo) => sum + costo.ValorTotal, 0);
}
