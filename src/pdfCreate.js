const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Logo local: antes se descargaba de Google Drive en cada correo (lento y falla si Drive no responde)
const LOGO = fs.readFileSync(path.join(__dirname, 'LogoPdNet.jpg'));

/** Texto seguro: nunca truena si el dato viene vacío, null o undefined */
const t = (valor) => (valor === undefined || valor === null ? '' : String(valor));
const may = (valor) => t(valor).toUpperCase();
/** Teléfono con su extensión, si la hay */
const tel = (numero, extension) => (t(extension).trim() ? `${t(numero)} Ext. ${t(extension).trim()}` : t(numero));

/** Crea el documento y regresa una promesa con el Buffer del PDF */
function crearPdf(escribir) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        try {
            escribir(doc);
            doc.fontSize(10).fillColor('#888').text('--- Fin del Reporte ---', { align: 'center' });
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function seccion(doc, titulo, lineas) {
    doc.fontSize(14).fillColor('#007bff').text(titulo, { underline: true }).fillColor('black').moveDown(0.5);
    doc.fontSize(11);
    for (const linea of lineas) doc.text(linea);
    doc.moveDown(1);
}

/**
 * PDF del alta de cliente (FormPdnt).
 * @param {Array} variables - variables[0] trae las secciones del formulario
 * @returns {Promise<Buffer>}
 */
async function generatePdfReport(variables) {
    const data = variables[0] || {};
    const df = data.datos_fiscales || {};
    const di = data.domicilio_instalacion || {};
    const fact = data.informacion_facturacion || {};
    const cob = data.informacion_cobranza || {};
    const banc = data.informacion_bancaria || {};
    const sitio = data.contacto_sitio || {};
    const vend = data.datos_vendedor || {};

    return crearPdf((doc) => {
        doc.image(LOGO, 50, 50, { width: 100 }).moveDown(2);
        doc.fontSize(18).text('DOCUMENTO DE ALTA DE CLIENTE', { align: 'center' }).moveDown(2);

        seccion(doc, 'Datos Fiscales', [
            `Razón Social / Nombre: ${may(df.razon_social)}`,
            `Régimen Fiscal: ${may(df.regimen_fiscal?.nombre)} (ID: ${t(df.regimen_fiscal?.id)})`,
            `RFC: ${may(df.rfc)}`,
            `Calle: ${may(df.calle)}`,
            `N° Int: ${t(df.numero_interior)}`,
            `N° Ext: ${t(df.numero_exterior)}`,
            `Colonia: ${may(df.colonia)}`,
            `C.P.: ${t(df.codigo_postal)}`,
            `Municipio: ${may(df.municipio)}`,
            `Estado: ${may(df.estado)}`,
            `Población: ${t(df.poblacion)}`,
            `País: ${may(df.pais)}`,
            `Zona: ${may(df.zona)}`,
            `Teléfono: ${tel(df.telefono, df.extension)}`,
            `Correo Electrónico: ${t(df.correo_electronico)}`,
            `Página Web: ${t(df.pagina_web)}`,
        ]);

        seccion(doc, 'Domicilio de Instalación', [
            `Calle: ${may(di.calle)}`,
            `N° Ext: ${t(di.numero_exterior)}`,
            `N° Int: ${t(di.numero_interior)}`,
            `Colonia: ${may(di.colonia)}`,
            `C.P.: ${t(di.codigo_postal)}`,
            `Municipio: ${may(di.municipio)}`,
            `Estado: ${may(di.estado)}`,
            `Población: ${t(di.poblacion)}`,
            `País: ${may(di.pais)}`,
            `Zona: ${may(di.zona)}`,
            `Teléfono: ${tel(di.telefono, di.extension)}`,
        ]);

        seccion(doc, 'Información para Facturación', [
            `Nombre Encargado: ${may(fact.nombre_encargado)}`,
            `Puesto: ${may(fact.puesto)}`,
            `Teléfono: ${tel(fact.telefono, fact.extension)}`,
            `Celular: ${t(fact.celular)}`,
            `Correo Electrónico: ${t(fact.correo_electronico)}`,
            `CFDI: ${t(fact.cfdi)}`,
            `Método de pago: ${t(fact.metodo_pago)}`,
            `Datos Adicionales: ${t(fact.datos_adicionales)}`,
        ]);

        seccion(doc, 'Información de Cobranza', [
            `Nombre Encargado: ${t(cob.nombre_encargado)}`,
            `Puesto: ${t(cob.puesto)}`,
            `Teléfono: ${tel(cob.telefono, cob.extension)}`,
            `Celular: ${t(cob.celular)}`,
            `Correo Electrónico: ${t(cob.correo_electronico)}`,
        ]);

        seccion(doc, 'Información Bancaria', [
            `N° de Cuenta: ${t(banc.numero_cuenta)}`,
            `N° de Cuenta Clabe: ${t(banc.numero_cuenta_clabe)}`,
            `Banco: ${may(banc.banco)}`,
        ]);

        seccion(doc, 'Contacto de Sitio', [
            `Ubicación: ${may(sitio.ubicacion)}`,
            `Coordenadas: ${t(sitio.coordenadas)}`,
            `Nombre Contacto Sitio: ${may(sitio.nombre_contacto_sitio)}`,
            `Teléfono: ${t(sitio.telefono)}`,
            `Celular: ${t(sitio.celular)}`,
            `Departamento: ${may(sitio.departamento)}`,
            `Horario de atención: ${t(sitio.horario_atencion)}`,
            `Megas Aproximados: ${t(sitio.megas_aproximados)}`,
            `Número de Enlaces: ${t(sitio.numero_enlaces)}`,
        ]);

        seccion(doc, 'Datos del Vendedor', [
            `Nombre Vendedor: ${may(vend.nombre_vendedor)}`,
            `Oficina: ${may(vend.oficina)}`,
            `Correos: ${t(vend.correos)}`,
            `Celular Vendedor: ${t(vend.celular_vendedor)}`,
        ]);
    });
}

/**
 * PDF de domiciliación (app domiciliar-cliente).
 * @param {Array} variables - variables[0] trae los datos de la domiciliación
 * @returns {Promise<Buffer>}
 */
async function generatePdfReportDomic(variables) {
    const data = variables[0] || {};
    const ahora = new Date();
    const enMexico = { timeZone: 'America/Mexico_City' };

    return crearPdf((doc) => {
        doc.image(LOGO, 50, 50, { width: 100 }).moveDown(3);
        doc.fontSize(18).fillColor('black').text('DOMICILIACION DE CLIENTE', { align: 'center' }).moveDown(1.5);

        seccion(doc, 'Datos Generales del Cliente', [
            `Fecha: ${ahora.toLocaleDateString('es-MX', enMexico)}`,
            `Hora: ${ahora.toLocaleTimeString('es-MX', enMexico)}`,
            `Entidad: ${t(data.entidad)}`,
            `Teléfono: ${t(data.telPerson)}`,
            `Email: ${t(data.emailPerson)}`,
        ]);

        seccion(doc, 'Servicio Contratado', [
            `Nombre del Cliente: ${t(data.numNameClient)}`,
            `Tipo de Servicio: ${t(data.typeServiceSelected)}`,
            `Plazo de Contratación: ${t(data.hiringPeriodSelected)}`,
        ]);

        seccion(doc, 'Información de Pago', [
            `Titular de la Cuenta: ${t(data.holder)}`,
            `Número de Cuenta: ${t(data.numAccount)}`,
            `Fecha de Vencimiento: ${t(data.dueDate)}`,
            `Días de Cargo: ${t(data.dayPaySelected)}`,
            `Cantidad Total: ${t(data.cantT)}`,
        ]);

        seccion(doc, 'Domicilio del Cliente', [`Dirección: ${t(data.address)}`]);

        seccion(doc, 'Aviso de privacidad', ['1. El cliente acepta el aviso de privacidad del servicio.']);
    });
}

module.exports = { generatePdfReport, generatePdfReportDomic };
