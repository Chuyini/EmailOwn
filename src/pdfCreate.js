const PDFDocument = require('pdfkit');
const axios = require('axios');
const fs = require('fs');


/**
 * Genera un PDF con los datos en 'variables' y retorna un Buffer
 * que luego puedes adjuntar en un correo con Nodemailer.
 * 
 * @param {Array} variables - Array con la info de tu reporte (variables[0] es el objeto principal)
 * @returns {Promise<Buffer>} - Devuelve un Buffer con el PDF
 */
async function generatePdfReport(variables) {

    // 1. Descargamos la imagen de la nube (Google Drive, etc.)
    const response = await axios.get('https://drive.google.com/uc?export=view&id=1v6uI_38OqosSeTBOWJW2M09ZD9JolvYn', { responseType: 'arraybuffer' });
    // Convertimos el 'arraybuffer' a Buffer
    const imageBuffer = Buffer.from(response.data, 'binary');

    return new Promise((resolve, reject) => {
        // Suponiendo que 'variables' es un array con un único objeto
        const data = variables[0];

        // Extraemos cada sección para simplificar
        const df = data.datos_fiscales;
        const di = data.domicilio_instalacion;
        const fact = data.informacion_facturacion;
        const cob = data.informacion_cobranza;
        const banc = data.informacion_bancaria;
        const sitio = data.contacto_sitio;
        const vend = data.datos_vendedor;

        // Creamos un nuevo documento PDF con PDFKit
        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

        // Aquí almacenaremos los 'chunks' (trozos) del PDF
        let buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => {
            // Al finalizar, concatenamos todos los chunks en un solo Buffer
            const pdfData = Buffer.concat(buffers);
            resolve(pdfData);
        });

        // Si ocurre un error al generar el PDF
        doc.on('error', (err) => {
            reject(err);
        });

        // ============ Comenzamos a escribir el PDF ============

        // Título principal
        // Insertar logo en la esquina superior izquierda
        doc.image(imageBuffer, 50, 50, { width: 100 })
            .moveDown(2); // baja un poco el cursor

        doc
            .fontSize(18)
            .text('DOCUMENTO DE ALTA DE CLIENTE', { align: 'center' })
            .moveDown(2);

        // ---- DATOS FISCALES ----
        doc
            .fontSize(14)
            .fillColor('#007bff')
            .text('Datos Fiscales', { underline: true })
            .fillColor('black')
            .moveDown(0.5);

        doc.fontSize(11)
            .text(`Razón Social / Nombre: ${df.razon_social}`)
            .text(`Régimen Fiscal: ${df.regimen_fiscal.nombre}`)
            .text(`RFC: ${df.rfc}`)
            .text(`Calle: ${df.calle}`)
            .text(`N° Int: ${df.numero_interior}`)
            .text(`N° Ext: ${df.numero_exterior}`)
            .text(`Colonia: ${df.colonia}`)
            .text(`C.P.: ${df.codigo_postal}`)
            .text(`Municipio: ${df.municipio}`)
            .text(`Estado: ${df.estado}`)
            .text(`Población: ${df.poblacion}`)
            .text(`País: ${df.pais}`)
            .text(`Zona: ${df.zona}`)
            .text(`Teléfono: ${df.telefono}`)
            .text(`Correo Electrónico: ${df.correo_electronico}`)
            .text(`Página Web: ${df.pagina_web}`)
            .moveDown(1);
        // ---- DOMICILIO DE INSTALACION ----
        doc
            .fontSize(14)
            .fillColor('#007bff')
            .text('Domicilio de Instalación', { underline: true })
            .fillColor('black')
            .moveDown(0.5);
        doc.fontSize(11)
            .text(`Calle: ${di.calle}`)
            .text(`N° Ext: ${di.numero_exterior}`)
            .text(`N° Int: ${di.numero_interior}`)
            .text(`Colonia: ${di.colonia}`)
            .text(`C.P.: ${di.codigo_postal}`)
            .text(`Municipio: ${di.municipio}`)
            .text(`Estado: ${di.estado}`)
            .text(`Población: ${di.poblacion}`)
            .text(`País: ${di.pais}`)
            .text(`Zona: ${di.zona}`)
            .text(`Teléfono: ${di.telefono}`)
            .moveDown(1);
        // ---- INFORMACIÓN PARA FACTURACIÓN ----
        doc
            .fontSize(14)
            .fillColor('#007bff')
            .text('Información para Facturación', { underline: true })
            .fillColor('black')
            .moveDown(0.5);
        doc.fontSize(11)
            .text(`Nombre Encargado: ${fact.nombre_encargado}`)
            .text(`Puesto: ${fact.puesto}`)
            .text(`Teléfono: ${fact.telefono}`)
            .text(`Celular: ${fact.celular}`)
            .text(`Correo Electrónico: ${fact.correo_electronico}`)
            .text(`CFDI: ${fact.cfdi}`)
            .text(`Método de pago: ${fact.metodo_pago}`)
            .text(`Datos Adicionales: ${fact.datos_adicionales}`)
            .moveDown(1);
        // ---- INFORMACIÓN DE COBRANZA ----
        doc
            .fontSize(14)
            .fillColor('#007bff')
            .text('Información de Cobranza', { underline: true })
            .fillColor('black')
            .moveDown(0.5);
        doc.fontSize(11)
            .text(`Nombre Encargado: ${cob.nombre_encargado}`)
            .text(`Puesto: ${cob.puesto}`)
            .text(`Teléfono: ${cob.telefono}`)
            .text(`Celular: ${cob.celular}`)
            .text(`Correo Electrónico: ${cob.correo_electronico}`)
            .moveDown(1);
        // ---- INFORMACIÓN BANCARIA ----
        doc
            .fontSize(14)
            .fillColor('#007bff')
            .text('Información Bancaria', { underline: true })
            .fillColor('black')
            .moveDown(0.5);
        doc.fontSize(11)
            .text(`N° de Cuenta: ${banc.numero_cuenta}`)
            .text(`N° de Cuenta Clabe: ${banc.numero_cuenta_clabe}`)
            .text(`Banco: ${banc.banco}`)
            .moveDown(1);
        // ---- CONTACTO DE SITIO ----
        doc
            .fontSize(14)
            .fillColor('#007bff')
            .text('Contacto de Sitio', { underline: true })
            .fillColor('black')
            .moveDown(0.5);
        doc.fontSize(11)
            .text(`Ubicación: ${sitio.ubicacion}`)
            .text(`Coordenadas: ${sitio.coordenadas}`)
            .text(`Nombre Contacto Sitio: ${sitio.nombre_contacto_sitio}`)
            .text(`Teléfono: ${sitio.telefono}`)
            .text(`Celular: ${sitio.celular}`)
            .text(`Departamento: ${sitio.departamento}`)
            .text(`Horario de atención: ${sitio.horario_atencion}`)
            .text(`Megas Aproximados: ${sitio.megas_aproximados}`)
            .text(`Número de Enlaces: ${sitio.numero_enlaces}`)
            .moveDown(1);
        // ---- DATOS DEL VENDEDOR ----
        doc
            .fontSize(14)
            .fillColor('#007bff')
            .text('Datos del Vendedor', { underline: true })
            .fillColor('black')
            .moveDown(0.5);
        doc.fontSize(11)
            .text(`Nombre Vendedor: ${vend.nombre_vendedor}`)
            .text(`Oficina: ${vend.oficina}`)
            .text(`Correos: ${vend.correos}`)
            .text(`Celular Vendedor: ${vend.celular_vendedor}`)
            .moveDown(2);
        // Pie de página opcional
        doc
            .fontSize(10)
            .fillColor('#888')
            .text('--- Fin del Reporte ---', { align: 'center' });
        // Cerramos el documento (gatilla el evento 'end')
        doc.end();
    });
}


async function generatePdfReportDomic(variables) {

    const response = await axios.get(
        "https://drive.google.com/uc?export=view&id=1v6uI_38OqosSeTBOWJW2M09ZD9JolvYn",
        { responseType: "arraybuffer" }
    );
    const imageBuffer = Buffer.from(response.data, "binary");

    return new Promise((resolve, reject) => {
        const data = variables[0]; // Extraemos el objeto principal

        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

        let y = 10; // Posición vertical inicial
        const addLine = (text, space = 10) => {
            doc.text(text, 10, y);
            y += space;
        };

        // Insertar imagen
        const imgData = `data:image/png;base64,${imageBuffer.toString("base64")}`;
        doc.addImage(imgData, "PNG", 10, y, 50, 20);
        y += 30;

        // Sección: Encabezado
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        addLine("DOCUMENTO DE ALTA DE CLIENTE");
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        addLine(`Fecha: ${new Date().toLocaleDateString()}`);
        addLine(`Hora: ${new Date().toLocaleTimeString()}`);
        addLine(`Entidad: ${data.entidad}`);
        addLine(`Teléfono: ${data.telPerson}`);
        addLine(`Email: ${data.emailPerson}`);
        addLine("----------------------------------------");

        // Datos del Cliente
        addLine(`Nombre del Cliente: ${data.numNameClient}`);
        addLine(`Tipo de Servicio: ${data.typeServiceSelected}`);
        addLine(`Plazo de Contratación: ${data.hiringPeriodSelected}`);
        addLine(`Titular de la Cuenta: ${data.holder}`);
        addLine(`Número de Cuenta: ${data.numAccount}`);
        addLine(`Fecha de Vencimiento: ${data.dueDate}`);
        addLine(`Domicilio: ${data.address}`);
        addLine(`Cantidad Total: ${data.cantT}`);
        addLine(`Días de Cargo: ${data.dayPaySelected}`);
        addLine("----------------------------------------");

        // Sección: Términos y Condiciones
        addLine("Términos y Condiciones:");
        addLine("1. El cliente acepta los términos y condiciones del servicio.");

        // Convertir a Blob y resolver la Promesa
        const pdfBlob = doc.output("blob");
        resolve(pdfBlob);
    });


}

module.exports = {
    generatePdfReport, generatePdfReportDomic
};
