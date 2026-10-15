require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '.env') }); // local: src/.env (no pisa lo que ya exista)

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { Dropbox } = require('dropbox');
const uid = require('uuid');
const { generatePdfReport, generatePdfReportDomic } = require('./pdfCreate');

const app = express();

app.use(cors({
  origin: [
    'https://formulario-pd-net.vercel.app',
    'https://domiciliar-cliente.vercel.app',
    'http://localhost:4200',
    'https://emailown-production.up.railway.app',
    'http://elpoderdeinternet.mx:8045',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Los adjuntos llegan en base64 (un ZIP de 50 MB pesa ~67 MB en base64)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const PORT = process.env.PORT || 3000; // Fly.io asigna PORT automáticamente
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de correos en http://0.0.0.0:${PORT}`);
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// Solo se envía a correos de estos dominios, para que nadie use el servidor para mandar spam
const DOMINIOS_PERMITIDOS = (process.env.DOMINIOS_PERMITIDOS || 'elpoderdeinternet.mx')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const correoValido = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || '').trim());

const correoPermitido = (correo) => {
  const dominio = String(correo || '').trim().toLowerCase().split('@')[1];
  return correoValido(correo) && DOMINIOS_PERMITIDOS.includes(dominio);
};

/** Acepta [{email}] o ["correo"]; regresa la lista sin repetidos o null si alguno no está permitido */
const destinatariosPermitidos = (to) => {
  const lista = (Array.isArray(to) ? to : [to])
    .map((t) => (typeof t === 'string' ? t : t?.email))
    .map((c) => String(c || '').trim())
    .filter(Boolean);
  const unicos = [...new Map(lista.map((c) => [c.toLowerCase(), c])).values()];
  if (unicos.length === 0 || unicos.length > 15 || !unicos.every(correoPermitido)) return null;
  return unicos;
};

const escaparHtml = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------------------
// Dropbox (los ZIP de documentos se suben ahí y se manda el enlace)
// ---------------------------------------------------------------------------

async function getAccessToken() {
  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
      client_id: process.env.DROPBOX_APP_KEY,
      client_secret: process.env.DROPBOX_APP_SECRET,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Error al obtener access_token de Dropbox: ${data.error}`);
  return data.access_token;
}

async function uploadToDropbox(fileBuffer, fileName) {
  const accessToken = await getAccessToken();
  const dbx = new Dropbox({ accessToken, fetch });

  const response = await dbx.filesUpload({
    path: `/${fileName}`,
    contents: fileBuffer,
    mode: { '.tag': 'overwrite' },
  });

  const sharedLink = await dbx.sharingCreateSharedLinkWithSettings({
    path: response.result.path_display,
  });

  const enlace = sharedLink.result.url.replace('?dl=0', '?dl=1'); // descarga directa
  console.log('ZIP subido a Dropbox:', fileName);
  return enlace;
}

/** Separa el ZIP (va a Dropbox) del resto de adjuntos (van en el correo) */
async function procesarAdjuntos(attachments, nombreZip) {
  const adjuntos = attachments.filter(Boolean);
  const zip = adjuntos.find((a) => String(a.filename || '').toLowerCase().endsWith('.zip'));
  let enlace = null;

  if (zip) {
    enlace = await uploadToDropbox(Buffer.from(zip.content, 'base64'), nombreZip);
  }
  return { enlace, otros: adjuntos.filter((a) => a !== zip) };
}

// ---------------------------------------------------------------------------
// Correo
// ---------------------------------------------------------------------------

let transporter;
const getTransporter = () => {
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL, pass: process.env.PASSWORD_GMAIL },
  });
  return transporter;
};

async function sendEmail(to, subject, html, attachments = []) {
  const info = await getTransporter().sendMail({ from: process.env.GMAIL, to, subject, html, attachments });
  console.log('Correo enviado a', to, '-', info.response);
  return info.response;
}

const cuerpoConEnlace = (texto, enlace) =>
  enlace
    ? `${escaparHtml(texto)} <br><br> <strong>Descarga los documentos aquí:</strong> <a href="${enlace}">${enlace}</a>`
    : `${escaparHtml(texto)} <br><br> <strong style="color: blue">No se subieron documentos .ZIP</strong>`;

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

app.get('/', (req, res) => res.json({ message: 'Servidor de correos funcionando' }));

// Alta de clientes (FormPdnt)
app.post('/send-email', async (req, res) => {
  const { to, subject, text, attachments, variables } = req.body;

  const destinatarios = destinatariosPermitidos(to);
  if (!destinatarios) {
    return res.status(400).json({ message: `Destinatarios inválidos: solo se permiten correos de ${DOMINIOS_PERMITIDOS.join(', ')}` });
  }
  if (!Array.isArray(attachments)) {
    return res.status(400).json({ message: '"attachments" debe ser un arreglo válido.' });
  }
  if (!Array.isArray(variables) || !variables[0]?.datos_fiscales) {
    return res.status(400).json({ message: 'Faltan los datos del alta ("variables").' });
  }

  const df = variables[0].datos_fiscales;
  console.log(`Alta recibida: ${df.razon_social || '(sin nombre)'} -> ${destinatarios.join(', ')}`);

  try {
    const rfc = String(df.rfc || 'SIN_RFC').replace(/[^A-Za-z0-9&Ñ]/g, '') || 'SIN_RFC';
    const { enlace, otros } = await procesarAdjuntos(attachments, `ClientesDocument_${rfc}_${uid.v4()}.zip`);

    const pdfBuffer = await generatePdfReport(variables);
    const adjuntos = [{ filename: 'Documento ALTA DE CLIENTE.pdf', content: pdfBuffer }, ...otros];

    const html = cuerpoConEnlace(text, enlace);
    await Promise.all(destinatarios.map((correo) => sendEmail(correo, subject || 'ALTA DE CLIENTES', html, adjuntos)));

    return res.status(200).json({ message: 'Correo enviado con éxito', driveLink: enlace });
  } catch (error) {
    console.error('Error al enviar el alta:', error.message);
    return res.status(500).json({ message: 'Error al enviar correo' });
  }
});

// Domiciliación de clientes (app domiciliar-cliente)
app.post('/send-email-domic', async (req, res) => {
  const { to, subject, text, attachments, variables } = req.body;

  const destinatarios = destinatariosPermitidos(to);
  if (!destinatarios) {
    return res.status(400).json({ message: `Destinatarios inválidos: solo se permiten correos de ${DOMINIOS_PERMITIDOS.join(', ')}` });
  }
  if (!Array.isArray(attachments)) {
    return res.status(400).json({ message: '"attachments" debe ser un arreglo válido.' });
  }
  if (!Array.isArray(variables) || !variables[0]) {
    return res.status(400).json({ message: 'Faltan los datos de la domiciliación ("variables").' });
  }

  console.log(`Domiciliación recibida -> ${destinatarios.join(', ')}`);

  try {
    const { enlace, otros } = await procesarAdjuntos(attachments, `ClientesDocument_Domic_${uid.v4()}.zip`);

    const pdfBuffer = await generatePdfReportDomic(variables);
    const adjuntos = [{ filename: 'Documento DOMICILIACION DE CLIENTE.pdf', content: pdfBuffer }, ...otros];

    await sendEmail(destinatarios, subject || 'DOMICILIACION DE CLIENTE', cuerpoConEnlace(text, enlace), adjuntos);
    return res.status(200).json({ message: 'Correo enviado con éxito', driveLink: enlace });
  } catch (error) {
    console.error('Error al enviar la domiciliación:', error.message);
    return res.status(500).json({ message: 'Error al enviar correo' });
  }
});

// Encuesta de satisfacción al terminar el alta: se manda a los mismos destinatarios del alta
const PREGUNTAS = {
  facilidad: '¿Qué tan fácil fue llenar el formulario? (1 a 5)',
  atencion: '¿Cómo calificas la atención de tu asesor? (1 a 5)',
  recomendacion: '¿Qué tan probable es que nos recomiendes? (0 a 10)',
};

app.post('/encuesta', async (req, res) => {
  const { cliente, vendedor, destinatarios: to, idioma, respuestas } = req.body || {};
  const r = respuestas || {};

  const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (!entero(r.facilidad, 1, 5) || !entero(r.atencion, 1, 5) || !entero(r.recomendacion, 0, 10)) {
    return res.status(400).json({ message: 'Respuestas incompletas o fuera de rango.' });
  }
  const comentarios = String(r.comentarios || '').slice(0, 1000);

  const extra = (process.env.ENCUESTA_DESTINO || '').split(',').map((c) => c.trim()).filter(Boolean);
  const destinatarios = destinatariosPermitidos([...(Array.isArray(to) ? to : []), ...extra]);
  if (!destinatarios) {
    return res.status(400).json({ message: 'Destinatarios inválidos para la encuesta.' });
  }

  const nps = r.recomendacion >= 9 ? 'Promotor' : r.recomendacion >= 7 ? 'Neutral' : 'Detractor';
  const fila = (pregunta, valor) =>
    `<tr><td style="padding:6px 10px;border:1px solid #ddd">${pregunta}</td><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold">${valor}</td></tr>`;

  const html = `
    <h2 style="margin:0 0 8px">Encuesta de satisfacción - Alta de clientes</h2>
    <p style="margin:0 0 12px">Cliente: <strong>${escaparHtml(String(cliente || '(sin nombre)').slice(0, 200))}</strong>
      ${vendedor ? ` · Vendedor: <strong>${escaparHtml(String(vendedor).slice(0, 100))}</strong>` : ''}
      · Idioma: ${escaparHtml(String(idioma || 'es').slice(0, 5))}</p>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
      ${fila(PREGUNTAS.facilidad, `${r.facilidad} / 5`)}
      ${fila(PREGUNTAS.atencion, `${r.atencion} / 5`)}
      ${fila(PREGUNTAS.recomendacion, `${r.recomendacion} / 10 (${nps})`)}
      ${fila('Comentarios', comentarios ? escaparHtml(comentarios).replace(/\n/g, '<br>') : '<em>Sin comentarios</em>')}
    </table>`;

  try {
    const asunto = `ENCUESTA DE SATISFACCIÓN - ${String(cliente || 'ALTA DE CLIENTE').slice(0, 80).toUpperCase()}`;
    await sendEmail(destinatarios, asunto, html);
    return res.status(200).json({ message: 'Encuesta recibida' });
  } catch (error) {
    console.error('Error al enviar la encuesta:', error.message);
    return res.status(500).json({ message: 'Error al enviar la encuesta' });
  }
});
