import { db } from './localDbService';
import { buildLoteResumen } from './calculationsService';
import { tratamientoEnRetiro } from './adminAnalyticsService';
import { createId } from '../lib/id';
import { todayISO } from '../lib/date';
import type { Alerta, Lote } from '../types/entities';

export async function generarAlertasBasicas(lote: Lote): Promise<Alerta[]> {
  const today = todayISO();
  const [registros, consumos, pesajes, loteGalpones, galpones, actividades, vacunas, syncQueue, inventario, entradas, salidas, facturasCompra, tratamientos] = await Promise.all([
    db.registroDiarioLote.where('LoteID').equals(lote.LoteID).toArray(),
    db.consumosAlimentoLote.where('LoteID').equals(lote.LoteID).toArray(),
    db.pesajes.where('LoteID').equals(lote.LoteID).toArray(),
    db.loteGalpones.where('LoteID').equals(lote.LoteID).toArray(),
    db.galpones.toArray(),
    db.actividadesLote.where('LoteID').equals(lote.LoteID).toArray(),
    db.vacunasLote.where('LoteID').equals(lote.LoteID).toArray(),
    db.syncQueue.toArray(),
    db.inventarioAlimento.toArray(),
    db.entradasAlimento.toArray(),
    db.salidasPollo.where('LoteID').equals(lote.LoteID).toArray(),
    db.facturasCompra.toArray(),
    db.tratamientosVeterinarios.where('LoteID').equals(lote.LoteID).toArray(),
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

  const nuevas: Alerta[] = [];
  if (resumen.MortalidadAcumulada > 0.03) {
    nuevas.push(crearAlerta(lote.LoteID, 'Mortalidad acumulada alta', 'ALTA', `Mortalidad acumulada en ${(resumen.MortalidadAcumulada * 100).toFixed(1)}%.`));
  }
  if (resumen.VacunasPendientes > 0) {
    nuevas.push(crearAlerta(lote.LoteID, 'Vacuna vencida', 'ALTA', `${resumen.VacunasPendientes} vacuna(s) pendiente(s) o vencida(s).`));
  }
  if (resumen.PendientesHoy > 0) {
    nuevas.push(crearAlerta(lote.LoteID, 'Actividad crítica no realizada', 'MEDIA', `${resumen.PendientesHoy} actividad(es) pendiente(s).`));
  }
  if (!registros.some((registro) => registro.Fecha === today)) {
    nuevas.push(crearAlerta(lote.LoteID, 'Falta registro diario', 'MEDIA', `No hay registro diario para ${today}.`));
  }
  if (!pesajes.some((pesaje) => pesaje.SemanaLote === Math.ceil(resumen.DiaLote / 7))) {
    nuevas.push(crearAlerta(lote.LoteID, 'Falta pesaje semanal', 'MEDIA', `No hay pesaje para la semana ${Math.ceil(resumen.DiaLote / 7)}.`));
  }
  if (inventario.some((item) => item.KgDisponibles < 800)) {
    nuevas.push(crearAlerta(lote.LoteID, 'Inventario bajo de alimento', 'ALTA', 'Hay alimento por debajo de 800 kg en inventario.'));
  }
  if (entradas.some((entrada) => entrada.EstadoAdmin !== 'COMPLETO')) {
    nuevas.push(crearAlerta(lote.LoteID, 'Precio pendiente', 'MEDIA', 'Hay entradas de alimento con proveedor, factura o precio pendiente.'));
  }
  if (salidas.some((salida) => salida.TipoSalida === 'VENTA' && salida.EstadoAdministrativo !== 'COMPLETO')) {
    nuevas.push(crearAlerta(lote.LoteID, 'Venta sin precio', 'ALTA', 'Hay ventas pendientes de precio o factura.'));
  }
  if (facturasCompra.some((factura) => factura.EstadoPago === 'PENDIENTE')) {
    nuevas.push(crearAlerta(lote.LoteID, 'Factura pendiente', 'MEDIA', 'Hay facturas de compra pendientes de pago.'));
  }
  if (tratamientos.some((tratamiento) => tratamiento.Estado === 'ACTIVO')) {
    nuevas.push(crearAlerta(lote.LoteID, 'Tratamiento veterinario pendiente', 'ALTA', 'Hay tratamientos veterinarios activos.'));
  }
  if (tratamientos.some((tratamiento) => tratamientoEnRetiro(tratamiento))) {
    nuevas.push(crearAlerta(lote.LoteID, 'Periodo de retiro pendiente', 'CRITICA', 'Hay tratamiento en periodo de retiro.'));
  }

  const existing = await db.alertas.where('LoteID').equals(lote.LoteID).and((alerta) => alerta.Estado === 'ABIERTA').toArray();
  const existingTypes = new Set(existing.map((alerta) => alerta.TipoAlerta));
  const missing = nuevas.filter((alerta) => !existingTypes.has(alerta.TipoAlerta));
  if (missing.length > 0) await db.alertas.bulkAdd(missing);
  return missing;
}

function crearAlerta(loteId: string, tipo: string, nivel: Alerta['Nivel'], mensaje: string): Alerta {
  return {
    AlertaID: createId('alerta'),
    Fecha: todayISO(),
    LoteID: loteId,
    TipoAlerta: tipo,
    Nivel: nivel,
    Mensaje: mensaje,
    Estado: 'ABIERTA',
    Responsable: 'user_admin',
    FechaResuelta: '',
    Observacion: '',
  };
}
