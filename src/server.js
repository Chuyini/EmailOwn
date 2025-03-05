require('dotenv').config(); // Carga las variables de entorno de .env
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');




const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); // Aumenta el límite de tamaño del cuerpo para manejar archivos grandes
// Endpoint para enviar correos
app.post('/send-email', async (req, res) => {
  // Extraer los datos que envía el frontend
  const { to, subject, text, attachments, variables } = req.body;
  console.log("Desde el servidor se recibio el body: ", req.body);
  try {

    if (attachments && attachments.length > 0) {
      const { filename, content, encoding } = attachments[0];
      //console.log(`Filename: ${filename}`);
      //console.log(`Content (base64): ${content}`);
      //console.log(`Encoding: ${encoding}`);
    }
    // Podrías generar un HTML más elaborado; aquí lo mantenemos sencillo
    const reportHtml = createHTMLReport(variables);

    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text}`);



    console.log(process.env.GMAIL)
    // Llamamos a la función que envía el correo
    await sendEmail(to, subject, reportHtml, attachments[0], attachments[1]);

    // Si todo sale bien, respondemos con éxito
    return res.status(200).json({ message: 'Correo enviado con éxito' });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return res.status(500).json({ message: 'Error al enviar correo', error });
  }
});

// Función para enviar el correo electrónico
async function sendEmail(to, subject, reportHtml, attachments, attachments2) {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL,
      pass: process.env.PASSWORD_GMAIL
    }
  });

  if (!attachments) {

    if (!attachments2) {
      let mailOptions = {
        from: process.env.GMAIL,
        to: to,               // Destinatario que viene del body
        subject: subject,     // Asunto que viene del body
        html: reportHtml,

        // HTML generado
      };
    }
    let mailOptions = {
      from: process.env.GMAIL,
      to: to,               // Destinatario que viene del body
      subject: subject,     // Asunto que viene del body
      html: reportHtml,
      attachments: [attachments2],
      // HTML generado
    };

  }
   
  if (!attachments2) {
    if (!attachments) {
      let mailOptions = {
        from: process.env.GMAIL,
        to: to,               // Destinatario que viene del body
        subject: subject,     // Asunto que viene del body
        html: reportHtml,
        // HTML generado
      };

    }
    let mailOptions = {
      from: process.env.GMAIL,
      to: to,               // Destinatario que viene del body
      subject: subject,     // Asunto que viene del body
      html: reportHtml,
      attachments: [attachments],
      // HTML generado
    };
  }



  // Nota: sendMail es asíncrono, pero podemos usar callbacks o await
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
  console.log(`Servidor de correos en http://localhost:${PORT} correo ${process.env.GMAIL}`);
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

  // Construimos un HTML con estilo sencillo
  const htmlReport = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte de Alta de Cliente</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0; 
      padding: 0; 
      background-color: #f4f4f4;
    }
    .container {
      width: 80%;
      margin: 20px auto;
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #333;
    }
    h2 {
      color: #007bff;
      border-bottom: 2px solid #007bff;
      padding-bottom: 5px;
      margin-top: 40px;
      margin-bottom: 10px;
    }
    p {
      margin: 5px 0;
      color: #444;
    }
    .bold {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reporte de Alta de Cliente</h1>

    <!-- DATOS FISCALES -->
    <h2>Datos Fiscales</h2>
    <p><span class="bold">Razón Social / Nombre:</span> ${df.razon_social}</p>
    <p><span class="bold">Régimen Fiscal (nombre):</span> ${df.regimen_fiscal.nombre}</p>
    <p><span class="bold">RFC:</span> ${df.rfc}</p>
    <p><span class="bold">Calle:</span> ${df.calle}</p>
    <p><span class="bold">N° Int:</span> ${df.numero_interior}</p>
    <p><span class="bold">N° Ext:</span> ${df.numero_exterior}</p>
    <p><span class="bold">Colonia:</span> ${df.colonia}</p>
    <p><span class="bold">C.P.:</span> ${df.codigo_postal}</p>
    <p><span class="bold">Municipio:</span> ${df.municipio}</p>
    <p><span class="bold">Estado:</span> ${df.estado}</p>
    <p><span class="bold">Población:</span> ${df.poblacion}</p>
    <p><span class="bold">País:</span> ${df.pais}</p>
    <p><span class="bold">Zona:</span> ${df.zona}</p>
    <p><span class="bold">Teléfono:</span> ${df.telefono}</p>
    <p><span class="bold">Correo Electrónico:</span> ${df.correo_electronico}</p>
    <p><span class="bold">Página Web:</span> ${df.pagina_web}</p>

    <!-- DOMICILIO DE INSTALACION -->
    <h2>Domicilio de Instalación</h2>
    <p><span class="bold">Calle:</span> ${di.calle}</p>
    <p><span class="bold">N° Ext:</span> ${di.numero_exterior}</p>
    <p><span class="bold">N° Int:</span> ${di.numero_interior}</p>
    <p><span class="bold">Colonia:</span> ${di.colonia}</p>
    <p><span class="bold">C.P.:</span> ${di.codigo_postal}</p>
    <p><span class="bold">Municipio:</span> ${di.municipio}</p>
    <p><span class="bold">Estado:</span> ${di.estado}</p>
    <p><span class="bold">Población:</span> ${di.poblacion}</p>
    <p><span class="bold">País:</span> ${di.pais}</p>
    <p><span class="bold">Zona:</span> ${di.zona}</p>
    <p><span class="bold">Teléfono:</span> ${di.telefono}</p>

    <!-- INFORMACIÓN PARA FACTURACIÓN -->
    <h2>Información para Facturación</h2>
    <p><span class="bold">Nombre Encargado:</span> ${fact.nombre_encargado}</p>
    <p><span class="bold">Puesto:</span> ${fact.puesto}</p>
    <p><span class="bold">Teléfono:</span> ${fact.telefono}</p>
    <p><span class="bold">Celular:</span> ${fact.celular}</p>
    <p><span class="bold">Correo Electrónico:</span> ${fact.correo_electronico}</p>
    <p><span class="bold">CFDI:</span> ${fact.cfdi}</p>
    <p><span class="bold">Método de pago:</span> ${fact.metodo_pago}</p>
    <p><span class="bold">Datos Adicionales:</span> ${fact.datos_adicionales}</p>

    <!-- INFORMACIÓN DE COBRANZA -->
    <h2>Información de Cobranza</h2>
    <p><span class="bold">Nombre Encargado:</span> ${cob.nombre_encargado}</p>
    <p><span class="bold">Puesto:</span> ${cob.puesto}</p>
    <p><span class="bold">Teléfono:</span> ${cob.telefono}</p>
    <p><span class="bold">Celular:</span> ${cob.celular}</p>
    <p><span class="bold">Correo Electrónico:</span> ${cob.correo_electronico}</p>

    <!-- INFORMACIÓN BANCARIA -->
    <h2>Información Bancaria</h2>
    <p><span class="bold">N° de Cuenta:</span> ${banc.numero_cuenta}</p>
    <p><span class="bold">N° de Cuenta Clabe:</span> ${banc.numero_cuenta_clabe}</p>
    <p><span class="bold">Banco:</span> ${banc.banco}</p>

    <!-- CONTACTO DE SITIO -->
    <h2>Contacto de Sitio</h2>
    <p><span class="bold">Ubicación:</span> ${sitio.ubicacion}</p>
    <p><span class="bold">Coordenadas:</span> ${sitio.coordenadas}</p>
    <p><span class="bold">Nombre Contacto Sitio:</span> ${sitio.nombre_contacto_sitio}</p>
    <p><span class="bold">Teléfono:</span> ${sitio.telefono}</p>
    <p><span class="bold">Celular:</span> ${sitio.celular}</p>
    <p><span class="bold">Departamento:</span> ${sitio.departamento}</p>
    <p><span class="bold">Horario de atención:</span> ${sitio.horario_atencion}</p>
    <p><span class="bold">Megas Aproximados:</span> ${sitio.megas_aproximados}</p>
    <p><span class="bold">Número de Enlaces:</span> ${sitio.numero_enlaces}</p>

    <!-- DATOS DEL VENDEDOR -->
    <h2>Datos del Vendedor</h2>
    <p><span class="bold">Nombre Vendedor:</span> ${vend.nombre_vendedor}</p>
    <p><span class="bold">Oficina:</span> ${vend.oficina}</p>
    <p><span class="bold">Correos:</span> ${vend.correos}</p>
    <p><span class="bold">Celular Vendedor:</span> ${vend.celular_vendedor}</p>
  </div>
</body>
</html>
`;

  return htmlReport;
}
