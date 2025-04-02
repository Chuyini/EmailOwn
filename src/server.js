require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { generatePdfReport } = require('./pdfCreate');
const fs = require('fs');
const google = require('googleapis');
const { PassThrough } = require('stream');
const app = express();

// Configurar CORS
app.use(cors({
  origin: ['https://formulario-pd-net.vercel.app', 'http://localhost:4200', 'https://emailown-production.up.railway.app'], // Array de orígenes permitidos
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Manejar preflight (OPTIONS)
app.options('/send-email', cors());

// Aumentar el límite del payload
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

async function uploadToDrive(attachment, fileName, mimeType) {
  try {
    console.log("📂 Verificando contenido del attachment...");
    console.log("Tipo de attachment.content:", typeof attachment.content);

    if (!attachment || !attachment.content) {
      throw new Error('❌ El archivo no tiene contenido válido.');
    }

    // Convertir Base64 a Buffer
    const buffer = Buffer.from(attachment.content, 'base64');
    console.log("✅ Buffer generado correctamente.");

    // Convertir Buffer a Readable Stream
    const stream = new PassThrough();
    stream.end(buffer);

    // Autenticación con Google Drive
    const auth = new google.google.auth.GoogleAuth({
      keyFile: 'client.json',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.google.drive({ version: 'v3', auth });

    // Subir el archivo a Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType,
      },
      media: {
        mimeType: mimeType,
        body: stream,  // 🔥 Ahora usamos un ReadableStream
      },
    });

    console.log('✅ Archivo subido con éxito:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error al subir archivo a Google Drive:', error);
  }
}

// 📩 Endpoint para enviar correo
app.post('/send-email', async (req, res) => {
  const { to, subject, text, attachments, variables } = req.body;
  console.log("Desde el servidor se recibió el body:", req.body);

  try {
    const reportHtml = createHTMLReport(variables);
    const pdfBuffer = await generatePdfReport(variables);
    attachments.push({ filename: 'Documento ALTA DE CLIENTE.pdf', content: pdfBuffer });
    const fileContent = attachments[1].content;
    console.log("Tipo de content:", typeof attachments[1].content);
 


   



    // 🔼 Subir ZIP a Drive y obtener enlace
    const driveLink = await uploadToDrive(attachments[1], 'Documentos.zip', 'application/zip');

    // Enviar el correo con el enlace
    const emailBody = `${text} <br><br> <strong>Descarga tu archivo aquí:</strong> <a href="${driveLink}">${driveLink}</a>`;
    await sendEmail(to, subject, emailBody, attachments[0], attachments[2]);

    return res.status(200).json({ message: 'Correo enviado con éxito', driveLink });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return res.status(500).json({ message: 'Error al enviar correo', error });
  }
});


// 📧 Función para enviar correos
async function sendEmail(to, subject, reportHtml, ...attachments) {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL,
      pass: process.env.PASSWORD_GMAIL
    }
  });

  let mailOptions = {
    from: process.env.GMAIL,
    to,
    subject,
    html: reportHtml,
    attachments: attachments.filter(a => a)
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error al enviar el correo:', error);
        reject(error);
      } else {
        console.log('Correo enviado:', info.response);
        resolve(info.response);
      }
    });
  });
}


// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de correos en http://localhost:${PORT}`);
});

function createHTMLReport(variables) {
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

  // Construimos un HTML con estilo más "formal y llamativo"
  const htmlReport = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte de Alta de Cliente</title>
  <style>
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      margin: 0; 
      padding: 0; 
      background-color: #fafafa;
      color: #333;
      line-height: 1.5;
    }
    .container {
      width: 65%;
      margin: 40px auto;
      background: #fff;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 0 15px rgba(0,0,0,0.1);
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #444;
      font-size: 28px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    h2 {
      color: #007bff;
      border-bottom: 2px solid #007bff;
      padding-bottom: 8px;
      margin-top: 40px;
      margin-bottom: 20px;
      text-align: center;
      text-transform: uppercase;
      font-size: 22px;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    .section-table td {
      padding: 10px 6px;
      vertical-align: top;
    }
    .label {
      font-weight: bold;
      width: 30%;
      text-align: right;
      color: #555;
      font-size: 16px;
    }
    .value {
      width: 70%;
      text-align: left;
      color: #333;
      font-size: 16px;
    }
    /* Opcional: líneas sutiles en la tabla */
    .section-table td {
      border-bottom: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reporte de Alta de Cliente</h1>

    <!-- DATOS FISCALES -->
    <h2>Datos Fiscales</h2>
    <table class="section-table">
      <tr><td class="label">Razón Social / Nombre:</td><td class="value">${df.razon_social}</td></tr>
      <tr><td class="label">Régimen Fiscal:</td><td class="value">${df.regimen_fiscal.nombre}</td></tr>
      <tr><td class="label">RFC:</td><td class="value">${df.rfc}</td></tr>
      <tr><td class="label">Calle:</td><td class="value">${df.calle}</td></tr>
      <tr><td class="label">N° Int:</td><td class="value">${df.numero_interior}</td></tr>
      <tr><td class="label">N° Ext:</td><td class="value">${df.numero_exterior}</td></tr>
      <tr><td class="label">Colonia:</td><td class="value">${df.colonia}</td></tr>
      <tr><td class="label">C.P.:</td><td class="value">${df.codigo_postal}</td></tr>
      <tr><td class="label">Municipio:</td><td class="value">${df.municipio}</td></tr>
      <tr><td class="label">Estado:</td><td class="value">${df.estado}</td></tr>
      <tr><td class="label">Población:</td><td class="value">${df.poblacion}</td></tr>
      <tr><td class="label">País:</td><td class="value">${df.pais}</td></tr>
      <tr><td class="label">Zona:</td><td class="value">${df.zona}</td></tr>
      <tr><td class="label">Teléfono:</td><td class="value">${df.telefono}</td></tr>
      <tr><td class="label">Correo Electrónico:</td><td class="value">${df.correo_electronico}</td></tr>
      <tr><td class="label">Página Web:</td><td class="value">${df.pagina_web}</td></tr>
    </table>

    <!-- DOMICILIO DE INSTALACION -->
    <h2>Domicilio de Instalación</h2>
    <table class="section-table">
      <tr><td class="label">Calle:</td><td class="value">${di.calle}</td></tr>
      <tr><td class="label">N° Ext:</td><td class="value">${di.numero_exterior}</td></tr>
      <tr><td class="label">N° Int:</td><td class="value">${di.numero_interior}</td></tr>
      <tr><td class="label">Colonia:</td><td class="value">${di.colonia}</td></tr>
      <tr><td class="label">C.P.:</td><td class="value">${di.codigo_postal}</td></tr>
      <tr><td class="label">Municipio:</td><td class="value">${di.municipio}</td></tr>
      <tr><td class="label">Estado:</td><td class="value">${di.estado}</td></tr>
      <tr><td class="label">Población:</td><td class="value">${di.poblacion}</td></tr>
      <tr><td class="label">País:</td><td class="value">${di.pais}</td></tr>
      <tr><td class="label">Zona:</td><td class="value">${di.zona}</td></tr>
      <tr><td class="label">Teléfono:</td><td class="value">${di.telefono}</td></tr>
    </table>
 
    <!-- INFORMACIÓN PARA FACTURACIÓN -->
    <h2>Información para Facturación</h2>
    <table class="section-table">
      <tr><td class="label">Nombre Encargado:</td><td class="value">${fact.nombre_encargado}</td></tr>
      <tr><td class="label">Puesto:</td><td class="value">${fact.puesto}</td></tr>
      <tr><td class="label">Teléfono:</td><td class="value">${fact.telefono}</td></tr>
      <tr><td class="label">Celular:</td><td class="value">${fact.celular}</td></tr>
      <tr><td class="label">Correo Electrónico:</td><td class="value">${fact.correo_electronico}</td></tr>
      <tr><td class="label">CFDI:</td><td class="value">${fact.cfdi}</td></tr>
      <tr><td class="label">Método de pago:</td><td class="value">${fact.metodo_pago}</td></tr>
      <tr><td class="label">Datos Adicionales:</td><td class="value">${fact.datos_adicionales}</td></tr>
    </table>

    <!-- INFORMACIÓN DE COBRANZA -->
    <h2>Información de Cobranza</h2>
    <table class="section-table">
      <tr><td class="label">Nombre Encargado:</td><td class="value">${cob.nombre_encargado}</td></tr>
      <tr><td class="label">Puesto:</td><td class="value">${cob.puesto}</td></tr>
      <tr><td class="label">Teléfono:</td><td class="value">${cob.telefono}</td></tr>
      <tr><td class="label">Celular:</td><td class="value">${cob.celular}</td></tr>
      <tr><td class="label">Correo Electrónico:</td><td class="value">${cob.correo_electronico}</td></tr>
    </table>

    <!-- INFORMACIÓN BANCARIA -->
    <h2>Información Bancaria</h2>
    <table class="section-table">
      <tr><td class="label">N° de Cuenta:</td><td class="value">${banc.numero_cuenta}</td></tr>
      <tr><td class="label">N° de Cuenta Clabe:</td><td class="value">${banc.numero_cuenta_clabe}</td></tr>
      <tr><td class="label">Banco:</td><td class="value">${banc.banco}</td></tr>
    </table>

    <!-- CONTACTO DE SITIO -->
    <h2>Contacto de Sitio</h2>
    <table class="section-table">
      <tr><td class="label">Ubicación:</td><td class="value">${sitio.ubicacion}</td></tr>
      <tr><td class="label">Coordenadas:</td><td class="value">${sitio.coordenadas}</td></tr>
      <tr><td class="label">Nombre Contacto Sitio:</td><td class="value">${sitio.nombre_contacto_sitio}</td></tr>
      <tr><td class="label">Teléfono:</td><td class="value">${sitio.telefono}</td></tr>
      <tr><td class="label">Celular:</td><td class="value">${sitio.celular}</td></tr>
      <tr><td class="label">Departamento:</td><td class="value">${sitio.departamento}</td></tr>
      <tr><td class="label">Horario de atención:</td><td class="value">${sitio.horario_atencion}</td></tr>
      <tr><td class="label">Megas Aproximados:</td><td class="value">${sitio.megas_aproximados}</td></tr>
      <tr><td class="label">Número de Enlaces:</td><td class="value">${sitio.numero_enlaces}</td></tr>
    </table>

    <!-- DATOS DEL VENDEDOR -->
    <h2>Datos del Vendedor</h2>
    <table class="section-table">
      <tr><td class="label">Nombre Vendedor:</td><td class="value">${vend.nombre_vendedor}</td></tr>
      <tr><td class="label">Oficina:</td><td class="value">${vend.oficina}</td></tr>
      <tr><td class="label">Correos:</td><td class="value">${vend.correos}</td></tr>
      <tr><td class="label">Celular Vendedor:</td><td class="value">${vend.celular_vendedor}</td></tr>
    </table>
  </div>
</body>
</html>
`;
  return htmlReport;
}






