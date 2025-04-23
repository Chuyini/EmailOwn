require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { generatePdfReport } = require('./pdfCreate');
const app = express();
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const uid = require('uuid');


// Configurar CORS correctamente
app.use(cors({
  origin: ['https://formulario-pd-net.vercel.app', 'https://domiciliar-cliente.vercel.app', 'http://localhost:4200', 'https://emailown-production.up.railway.app'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Manejar preflight (OPTIONS)
app.options('/send-email', cors());
app.options('/send-email-domic', cors());

// Aumentar el límite del payload
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de correos en http://localhost:${PORT}`);
});


// Función para obtener un nuevo access_token con refresh_token
async function getAccessToken() {
  const response = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
      client_id: process.env.DROPBOX_APP_KEY,
      client_secret: process.env.DROPBOX_APP_SECRET,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`❌ Error al obtener access_token: ${data.error}`);
  return data.access_token;
}

// Función para subir archivo a Dropbox
async function uploadToDropbox(fileBuffer, fileName) {
  console.log("Obteniendo la llave ...");
  //process.env.DROPBOX_ACCES_TOKEN//
  const accessToken = await getAccessToken(); // Obtener nuevo token antes de subir
  console.log("Termino de obtener la llaver");
  const dbx = new Dropbox({ accessToken, fetch });

  try {
    const response = await dbx.filesUpload({
      path: `/${fileName}`, // Asegurar que es un STRING
      contents: fileBuffer,  // Mandar el Buffer directamente
      mode: { ".tag": "overwrite" },
    });

    // 🔗 Generar enlace compartido
    const sharedLink = await dbx.sharingCreateSharedLinkWithSettings({
      path: response.result.path_display,
    });

    console.log("✅ Archivo subido. Enlace: ", sharedLink.result.url.replace("?dl=0", "?dl=1"));
    return sharedLink.result.url.replace("?dl=0", "?dl=1"); // Descargar directamente
  } catch (error) {
    console.error("❌ Error al subir a Dropbox:", error);
    throw error;
  }
}


/*async function uploadToDropbox(filePath, fileName) {

  console.log('🔐 Configurando Dropbox...');
  const dbx = new Dropbox({
    accessToken: 'sl.u.AFprkLBws2ZsWRTxUU4g96kWOf_9lftNuW63f2SL6hanG0HwFSDpDQ2T6dcNPJ4bDM_G7rwKiJjo1w7rpoTnE7QefITTrYO4DcZHR77Rm3cl7Wmfou54CnluV9h9bY0UAUfv4yHGi-ibXg8Xo1yGuG6eYd9mGKCckkOv0m62XTdycBBdu7CLJgP4ck67_ZTYDIURKLnOduNPfvZgQAYx4B9UHbbXjZYVJXDSX_DMB1zAroXJOGuHJq74kel7cMSnalLGkOn8rJD219QnKJOlvqx2pK81PXsIT4b3loFlqYDFRDbgs37F2WUSJsVcPXOUMP_RKFpI5hIotbiGEJpcMnkd9ROrqLWSDe7FzCcMSV85A1JXD7omuKoJKc2CSHL5zkNKGw4PbWoJYsnqjZTTnektkKYve1WabFyArT2v5udi2XOg945mPkm2WB_35t78IGNwW_wM7tk4SOJ_B_lWkdUsjHJnV7uI9o38YsfspUAorjl4M32GM4Xun4SkideSqRX88NGc_Pqzb7tJZPdZc0rFAbAWajOttmQ2e50lVAQEEzAf7fnRohTzcLETArLHbd7xCzfCNBF6Ba51lSEuhuJDYMMmyNzcDsDtzqFKUvWLW7dWnmbBrdqOnQZIwzL5RG7xhNaDBax-dTiO0CqH4xR54GHUfN0-zu4AlSYKxMzxSi81V164zt5y1Wiku3jk3jEXudwNoObGiDuarQ72b1ffjEsc-fnjmYvCcRy7N8BwcdozQXLlW1FX4Das8Dw--DnWYmphxmxZoZZqOh_z-YAFGw45F4QVsJUvD5xtLgIXQwODJw9TmV_uV3v5or1c20jTw4W1D_c9gotNZGp2dhTkReRP2rWojKWcuhJgKPccfAC8F6_xGAu88CzFo9flHkDKuCNedeHKPmqjXH8hl3uTAIP-8PqbVO1pd6EfBP88zbIr3NSmyhUxy0U6yXkWywoBCFsDSc7o-NoFIidspLflR8BSuj_uaPrl8rVT-MnNrTFqKh07DteR1wO_9Q2U6MbS70IX96YM2DYtnrq_vcO_zJOOQCDa6BjH1qt4VdgUCl4K1Kted5bUuHpTrX0nQ8GSrsStXeQRXG5e28Hu-kPXFMa1whdUcPaesjCPXZjMB8B-wBTrG53TzRQrb6dj-CH3rNa6kGiW2_w497nC_zRYKs1O9aEA5fmfK0XHo7OiHcDuqkCEz4FEoCCkjWXaqb7WRYYsG5ZdrY5YkpF4d2A3TZUt6ucOdf49Sf4c7WDqRoOjoEnnyiAOGxtOhZ90O11o2T9PPThPF108069Ss4iPvE2isNkbvd4NW4RCcibcbxiK7aTcNUEH7AqL2f-W_eYusRyW4-rvEtf1IYLcrk2H8Y8-65Ff9PE3xStaIkodT9oZDd1IDuB4M1USd-_3aJ0KIXxdb8eBjlWKfpboqhMCxLJMSlQtJgSV1BA--kieLG8jQG6AWI4Yg5YHfdFMGAk',
  });

  try {
    const response = await dbx.filesUpload({
      path: `/${fileName}`, // Asegurar que es un STRING
      contents: fileBuffer,  // Mandar el Buffer directamente
      mode: { ".tag": "overwrite" },
    });

    // 🔗 Generar enlace compartido
    const sharedLink = await dbx.sharingCreateSharedLinkWithSettings({
      path: response.result.path_display,
    });

    console.log("Enlace: ", sharedLink.result.url.replace("?dl=0", "?dl=1"));
    return sharedLink.result.url.replace("?dl=0", "?dl=1"); // Descargar directamente
  } catch (error) {
    console.error("❌ Error al subir a Dropbox:", error);
    throw error;
  }
}*/

// Llama a esta función con la ruta al archivo local

//js

// 📩 Endpoint para enviar correo
app.post('/send-email', async (req, res) => {
  const { to, subject, text, attachments, variables } = req.body;
  console.log("Desde el servidor se recibió el body:", req.body);
  console.log("Impresion de las variables ");
  printVariables(variables);

  try {
    //const reportHtml = createHTMLReport(variables);
    //validacion de si esta vacio los archivos:
    let driveLink = null;
    if (!Array.isArray(attachments)) {
      console.error('Error: "attachments" no es un arreglo.', attachments);
      return res.status(400).json({ message: '"attachments" debe ser un arreglo válido.' });
    }
  

    //para cada elemento que exista
    const trueAttachments = attachments.filter(item => item);
    let zip;

    if (trueAttachments.length > 0) {

      for (const item of trueAttachments) {

        if (item.filename.endsWith('.zip')) {
          const fileContent = item.content;
          console.log("Tipo de content:", typeof item.content);
          const fileContentBuffer = Buffer.from(fileContent, 'base64');
          const data = variables[0];
          const df = data.datos_fiscales;
          console.log("Datios fiscales:", df);
          const uniqueFileName = `ClientesDocument_${df.rfc}_${uid.v4()}.zip`;
          console.log("Nombre del archivo:", uniqueFileName);
          if (uniqueFileName.includes("/") || uniqueFileName.includes("\\") || !uniqueFileName) {
            throw new Error("Nombre del archivo contiene caracteres inválidos.");
          }
          zip = item;
          driveLink = await uploadToDropbox(fileContentBuffer, uniqueFileName);
        }

      }
    }


    //const fileContent = attachments[1].content;
    //console.log("Tipo de content:", typeof attachments[1].content);

    //el to es un arreglo con varios objetos


    //const fileContentBuffer = Buffer.from(fileContent, 'base64');


    const pdfBuffer = await generatePdfReport(variables);//generamos el PDF DEL ALTA DE CLIENTE
    const validateAttachments = trueAttachments.filter(a => a !== zip) // Elimina todas las ocurrencias de `zip`
    validateAttachments.unshift({ filename: 'Documento ALTA DE CLIENTE.pdf', content: pdfBuffer });//queda en la posicion 0

    /*const data = variables[0];
    const df = data.datos_fiscales;*/
    // console.log("Datios fiscales:", df);
    // 🔼 Subir ZIP a Drive y obtener enlace
    // validacion:
    //const uniqueFileName = `ClientesDocument_${df.rfc}_${uid.v4()}.zip`;
    /*console.log("Nombre del archivo:", uniqueFileName);
    if (uniqueFileName.includes("/") || uniqueFileName.includes("\\") || !uniqueFileName) {
      throw new Error("Nombre del archivo contiene caracteres inválidos.");
    }*/

    //const driveLink = await uploadToDropbox(fileContentBuffer, uniqueFileName);

    // Enviar el correo con el enlace
    //to contiene todo los correos 
    //map sirve para hacer algo con cada elemntp de un arreglo
    //Promise all es para manejar concurrencia y optmizar utiempo
    if (driveLink != null) {
      const emailBody = `${text} <br><br> <strong>Descarga tu archivo aquí:</strong> <a href="${driveLink}">${driveLink}</a>`;
      await Promise.all(
        to.map(emailObject => sendEmail(emailObject.email, subject, emailBody, validateAttachments))
      );
      return res.status(200).json({ message: 'Correo enviado con éxito', driveLink });
    } else {
      const emailBody = `${text} <br><br> <strong style = "color: blue">No se subieron documentos .ZIP :</strong>`;
      await Promise.all(
        to.map(emailObject => sendEmail(emailObject.email, subject, emailBody, validateAttachments))
      );
      return res.status(200).json({ message: 'Correo enviado con éxito sin enlace' });
    }

  } catch (error) {
    console.error('Error al enviar correo:', error);
    return res.status(500).json({ message: 'Error al enviar correo', error });
  }
});

// 📧 Función para enviar correos
async function sendEmail(to, subject, reportHtml, attachments) {
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


function printVariables(variables) {
  const data = variables[0];

  // Extraemos cada sección para simplificar
  const df = data.datos_fiscales;
  const di = data.domicilio_instalacion;
  const fact = data.informacion_facturacion;
  const cob = data.informacion_cobranza;
  const banc = data.informacion_bancaria;
  const sitio = data.contacto_sitio;
  const vend = data.datos_vendedor;

  console.log("Datos Fiscales (df):", df);
  console.log("Domicilio de Instalación (di):", di);
  console.log("Información de Facturación (fact):", fact);
  console.log("Información de Cobranza (cob):", cob);
  console.log("Información Bancaria (banc):", banc);
  console.log("Contacto del Sitio (sitio):", sitio);
  console.log("Datos del Vendedor (vend):", vend);
}


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

  console.log("Datos Fiscales:", df);
  console.log("Domicilio de Instalación:", di);
  console.log("Información de Facturación:", fact);
  console.log("Información de Cobranza:", cob);
  console.log("Información Bancaria:", banc);
  console.log("Contacto del Sitio:", sitio);
  console.log("Datos del Vendedor:", vend);




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
function createHTMLReportDomic(variables) {
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

